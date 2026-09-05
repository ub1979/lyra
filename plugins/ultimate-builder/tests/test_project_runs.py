from __future__ import annotations

import importlib.util
from pathlib import Path


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
