from __future__ import annotations

import importlib.util
from pathlib import Path
import pytest


ROOT = Path(__file__).resolve().parents[1]


def load_project_runs():
    path = ROOT / "project_runs.py"
    spec = importlib.util.spec_from_file_location(
        "ultimate_builder_project_runs_test", path
    )
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)
    return module


def test_queue_creates_dependency_ordered_recoverable_jobs(tmp_path, monkeypatch):
    monkeypatch.setenv("HERMES_KANBAN_HOME", str(tmp_path / "hermes"))
    monkeypatch.setenv("HERMES_SESSION_KEY", "project-chat-1")
    project = tmp_path / "project"
    project.mkdir()
    module = load_project_runs()

    queued = module.queue_project_run(
        project,
        ["researcher", "sw-architect"],
        models={"researcher": "research-model"},
    )
    state = module.project_run_state(project)

    assert [task["phase"] for task in queued["tasks"]] == [
        "researcher",
        "sw-architect",
    ]
    assert [task["status"] for task in queued["tasks"]] == ["ready", "todo"]
    assert queued["repository"]["root"] == str(project.resolve())
    assert queued["repository"]["has_remote"] is False
    assert state["available"] is True
    assert state["active_task_count"] == 2
    with module.kb.connect_closing() as conn:
        first = module.kb.get_task(conn, queued["tasks"][0]["task_id"])
        second = module.kb.get_task(conn, queued["tasks"][1]["task_id"])
        subscriptions = module.kb.list_notify_subs(conn)
    assert first is not None and first.model_override == "research-model"
    assert second is not None and second.status == "todo"
    assert subscriptions[0]["platform"] == "tui"
    assert subscriptions[0]["chat_id"] == "project-chat-1"


def test_reopening_chat_reuses_existing_phase_job(tmp_path, monkeypatch):
    monkeypatch.setenv("HERMES_KANBAN_HOME", str(tmp_path / "hermes"))
    project = tmp_path / "project"
    project.mkdir()
    module = load_project_runs()

    first = module.queue_project_run(project, ["sw-developer"])
    second = module.queue_project_run(project, ["sw-developer"])

    assert second["tasks"][0]["task_id"] == first["tasks"][0]["task_id"]
    assert second["tasks"][0]["reused"] is True


@pytest.mark.parametrize("enabled", [True, False])
def test_reused_phase_repairs_missing_origin_subscription_unless_opted_out(tmp_path, monkeypatch, enabled):
    from hermes_cli import kanban_notifications
    from gateway.session_context import set_session_vars

    monkeypatch.setenv("HERMES_KANBAN_HOME", str(tmp_path / "hermes"))
    monkeypatch.setenv("HERMES_HOME", str(tmp_path / "hermes"))
    monkeypatch.setattr(kanban_notifications, "load_config", lambda: {
        "kanban": {"auto_subscribe_on_create": enabled},
    })
    project = tmp_path / "project"
    project.mkdir()
    module = load_project_runs()
    tokens = set_session_vars(session_key="")
    try:
        first = module.queue_project_run(project, ["sw-developer"])
        assert not first["tasks"][0]["subscribed"]
        linked = set_session_vars(session_key="resumed-project-chat")
        try:
            for _ in range(2):
                reused = module.queue_project_run(project, ["sw-developer"])["tasks"][0]
                assert reused["reused"]
                assert reused["task_id"] == first["tasks"][0]["task_id"]
                assert reused["subscribed"] is enabled
            with module.kb.connect_closing() as conn:
                subscriptions = module.kb.list_notify_subs(conn)
            assert len(subscriptions) == (1 if enabled else 0)
            if enabled:
                assert subscriptions[0]["chat_id"] == "resumed-project-chat"
        finally:
            for token in reversed(linked):
                token.var.reset(token)
    finally:
        for token in reversed(tokens):
            token.var.reset(token)


def test_invalid_automatic_worker_is_rejected_before_any_job_is_created(tmp_path, monkeypatch):
    monkeypatch.setenv("HERMES_KANBAN_HOME", str(tmp_path / "hermes"))
    monkeypatch.setenv("HERMES_HOME", str(tmp_path / "hermes"))
    project = tmp_path / "project"
    project.mkdir()
    module = load_project_runs()
    with pytest.raises(ValueError, match="does not exist"):
        module.queue_project_run(project, ["researcher", "sw-architect"], assignee="missing-lyra-worker")
    assert module.project_run_state(project)["tasks"] == []
    assert not (project / ".git").exists()


def test_generic_project_jobs_remain_visible_and_recover_after_assignment(tmp_path, monkeypatch):
    monkeypatch.setenv("HERMES_KANBAN_HOME", str(tmp_path / "hermes"))
    monkeypatch.setenv("HERMES_HOME", str(tmp_path / "hermes"))
    project = tmp_path / "project"
    project.mkdir()
    other = tmp_path / "other"
    other.mkdir()
    module = load_project_runs()
    managed = module.queue_project_run(project, ["sw-architect"])["tasks"][0]["task_id"]
    with module.kb.connect_closing() as conn:
        assert module.kb.claim_task(conn, managed)
        assert module.kb.complete_task(conn, managed, result="Architecture done")
        generic = module.kb.create_task(conn, title="Build task graph", assignee="missing-lyra-worker",
            workspace_kind="dir", workspace_path=str(project), idempotency_key="custom-task-graph")
        unrelated = module.kb.create_task(conn, title="Other project", assignee="default",
            workspace_kind="dir", workspace_path=str(other))
    state = load_project_runs().project_run_state(project)
    assert state["state"] == "needs_attention"
    assert not state["active"]
    tasks = {task["task_id"]: task for task in state["tasks"]}
    assert set(tasks) == {managed, generic}
    assert tasks[generic]["label"] == "Build task graph"
    assert tasks[generic]["status"] == "ready"
    assert "cannot start automatically" in tasks[generic]["dispatch_issue"]
    assert tasks[managed]["status"] == "done"
    with module.kb.connect_closing() as conn:
        # Reading Studio status never rewrites a legitimate external lane.
        assert module.kb.get_task(conn, generic).assignee == "missing-lyra-worker"
        assert module.kb.assign_task(conn, generic, "default")
    queued = module.project_run_state(project)
    assert queued["state"] == "queued"
    assert queued["active"]
    assert all(not task["dispatch_issue"] for task in queued["tasks"])
    assert module.control_project_run(project, "pause")["changed"] == [generic]
    with module.kb.connect_closing() as conn:
        assert module.kb.get_task(conn, unrelated).status == "ready"
    assert module.control_project_run(project, "resume")["changed"] == [generic]
    with module.kb.connect_closing() as conn:
        assert module.kb.claim_task(conn, generic)
    assert module.project_run_state(project)["state"] == "working"


def test_generic_jobs_move_with_their_project(tmp_path, monkeypatch):
    monkeypatch.setenv("HERMES_KANBAN_HOME", str(tmp_path / "hermes"))
    source = tmp_path / "source"
    source.mkdir()
    destination = tmp_path / "destination"
    module = load_project_runs()
    with module.kb.connect_closing() as conn:
        task_id = module.kb.create_task(conn, title="Custom project job", assignee="default",
            workspace_kind="dir", workspace_path=str(source))
    source.rename(destination)
    assert module.relocate_project_runs(source, destination)["changed"] == [task_id]
    assert module.project_run_state(destination)["tasks"][0]["task_id"] == task_id


def test_pause_and_resume_only_touch_user_paused_jobs(tmp_path, monkeypatch):
    monkeypatch.setenv("HERMES_KANBAN_HOME", str(tmp_path / "hermes"))
    project = tmp_path / "project"
    project.mkdir()
    module = load_project_runs()
    queued = module.queue_project_run(project, ["sw-developer"])
    task_id = queued["tasks"][0]["task_id"]

    paused = module.control_project_run(project, "pause")
    assert paused["changed"] == [task_id]
    assert module.project_run_state(project)["tasks"][0]["status"] == "blocked"
    assert module.project_run_state(project)["tasks"][0]["paused_by_user"] is True

    resumed = module.control_project_run(project, "resume")
    assert resumed["changed"] == [task_id]
    assert module.project_run_state(project)["tasks"][0]["status"] == "ready"


def test_moving_project_keeps_saved_jobs_attached(tmp_path, monkeypatch):
    monkeypatch.setenv("HERMES_KANBAN_HOME", str(tmp_path / "hermes"))
    project = tmp_path / "old" / "project"
    project.mkdir(parents=True)
    module = load_project_runs()
    queued = module.queue_project_run(project, ["sw-developer"])
    destination = tmp_path / "new" / "project"
    destination.parent.mkdir()
    project.rename(destination)

    result = module.relocate_project_runs(project, destination)

    assert result["changed"] == [queued["tasks"][0]["task_id"]]
    assert module.project_run_state(destination)["task_count"] == 1
    with module.kb.connect_closing() as conn:
        task = module.kb.get_task(conn, queued["tasks"][0]["task_id"])
    assert task is not None
    assert task.workspace_path == str(destination)
    assert f"Workspace: {destination}" in (task.body or "")


def test_saved_activity_survives_reload_and_explains_waiting(tmp_path, monkeypatch):
    """Exercise real SQLite lifecycle, not a mocked dashboard response."""
    monkeypatch.setenv("HERMES_KANBAN_HOME", str(tmp_path / "board"))
    project = tmp_path / "project"
    project.mkdir()
    module = load_project_runs()
    queued = module.queue_project_run(project, ["researcher", "sw-architect"])
    research, architecture = [task["task_id"] for task in queued["tasks"]]
    with module.kb.connect_closing() as conn:
        assert module.kb.claim_task(conn, research)
    running = {
        task["phase"]: task for task in module.project_run_state(project)["tasks"]
    }
    assert running["researcher"]["status"] == "running"
    assert running["sw-architect"]["status"] == "todo"
    with module.kb.connect_closing() as conn:
        assert module.kb.complete_task(conn, research, result="Research saved")
        module.kb.recompute_ready(conn)
        assert module.kb.claim_task(conn, architecture)
        assert module.kb.block_task(
            conn, architecture, reason="Which launch country?", kind="needs_input"
        )

    # A fresh module/connection can reconstruct both completed and waiting jobs.
    reloaded = load_project_runs().project_run_state(project)
    states = {task["phase"]: task for task in reloaded["tasks"]}
    assert states["researcher"]["status"] == "done"
    assert states["sw-architect"]["block_kind"] == "needs_input"
    assert states["sw-architect"]["wait_reason"] == "Which launch country?"
    assert states["sw-architect"]["last_error"] == ""
    assert states["sw-architect"]["paused_by_user"] is False
    assert reloaded["state"] == "needs_attention"

    with module.kb.connect_closing() as conn:
        assert module.kb.unblock_task(conn, architecture)
    resumed = {
        task["phase"]: task for task in module.project_run_state(project)["tasks"]
    }
    assert resumed["sw-architect"]["status"] == "ready"
    assert resumed["sw-architect"]["wait_reason"] == ""
    assert resumed["sw-architect"]["block_kind"] is None
    other = tmp_path / "other-project"
    other.mkdir()
    assert module.project_run_state(other)["tasks"] == []
