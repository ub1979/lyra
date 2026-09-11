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


@pytest.mark.parametrize(
    ("last_activity_at", "expected"),
    [(950, "fresh"), (800, "quiet"), (300, "stalled"), (None, "stalled")],
)
def test_running_activity_health_never_hides_silence(last_activity_at, expected):
    module = load_project_runs()
    health, age = module._activity_health("running", last_activity_at, now=1_000)
    assert health == expected
    assert age == (None if last_activity_at is None else 1_000 - last_activity_at)


def test_completed_activity_is_settled_not_stalled():
    assert load_project_runs()._activity_health("done", 1, now=1_000) == (
        "settled",
        None,
    )


def test_worker_reads_compact_status_before_detailed_progress():
    body = load_project_runs()._task_body(Path("/project"), "sw-developer")
    assert body.index(".sdlc/status.json") < body.index(".sdlc/progress.md")
    assert "do not hand-edit the snapshot" in body
    assert "Universal worker contract:" in body


def test_invalid_workflow_contract_stops_before_project_mutation(tmp_path, monkeypatch):
    project = tmp_path / "project"
    project.mkdir()
    module = load_project_runs()

    class InvalidContract:
        @staticmethod
        def assert_valid_contract():
            raise RuntimeError("foreign alias")

    monkeypatch.setattr(module, "_workflow_contract_module", lambda: InvalidContract)

    with pytest.raises(RuntimeError, match="foreign alias"):
        module.queue_project_run(project, ["sw-developer"])
    assert not (project / ".git").exists()
    assert not (project / ".sdlc").exists()


def test_stalled_saved_job_changes_the_project_state_to_attention(tmp_path, monkeypatch):
    monkeypatch.setenv("HERMES_KANBAN_HOME", str(tmp_path / "hermes"))
    project = tmp_path / "project"
    project.mkdir()
    module = load_project_runs()
    task_id = module.queue_project_run(project, ["sw-developer"])["tasks"][0]["task_id"]
    now = int(module.time.time())
    with module.kb.connect_closing() as conn:
        assert module.kb.claim_task(conn, task_id)
        with module.kb.write_txn(conn):
            conn.execute(
                "UPDATE tasks SET last_heartbeat_at = ? WHERE id = ?",
                (now - module.STALLED_ACTIVITY_SECONDS, task_id),
            )
    monkeypatch.setattr(module.time, "time", lambda: now)

    state = module.project_run_state(project)

    assert state["state"] == "needs_attention"
    assert state["active"] is True
    assert state["tasks"][0]["activity_health"] == "stalled"


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
        providers={"researcher": "research-provider"},
    )
    state = module.project_run_state(project)

    assert [task["phase"] for task in queued["tasks"]] == [
        "researcher",
        "sw-architect",
    ]
    assert [task["status"] for task in queued["tasks"]] == ["ready", "todo"]
    assert queued["repository"]["root"] == str(project.resolve())
    assert queued["repository"]["has_remote"] is False
    assert queued["learning_reconciliation"]["ok"] is True
    assert queued["status_snapshot"]["path"] == ".sdlc/status.json"
    assert (project / ".sdlc" / "status.json").is_file()
    assert state["available"] is True
    assert state["active_task_count"] == 2
    with module.kb.connect_closing() as conn:
        first = module.kb.get_task(conn, queued["tasks"][0]["task_id"])
        second = module.kb.get_task(conn, queued["tasks"][1]["task_id"])
        subscriptions = module.kb.list_notify_subs(conn)
    assert first is not None and first.model_override == "research-model"
    assert first.provider_override == "research-provider"
    assert second is not None and second.status == "todo"
    assert subscriptions[0]["platform"] == "tui"
    assert subscriptions[0]["chat_id"] == "project-chat-1"


def test_queue_reconciles_legacy_debug_lessons_and_loads_only_specialist_skill(
    tmp_path, monkeypatch
):
    monkeypatch.setenv("HERMES_KANBAN_HOME", str(tmp_path / "hermes"))
    project = tmp_path / "project"
    sdlc = project / ".sdlc"
    sdlc.mkdir(parents=True)
    (sdlc / "debug-learnings.jsonl").write_text(
        '{"date":"2026-09-11","bug":"stale answer","lesson":"fence the request"}\n',
        encoding="utf-8",
    )
    module = load_project_runs()

    queued = module.queue_project_run(project, ["sw-developer"])

    assert queued["learning_reconciliation"]["imported"] == 1
    assert (sdlc / "debug-learnings.jsonl").is_file()
    assert (sdlc / "learnings.jsonl").is_file()
    with module.kb.connect_closing() as conn:
        task = module.kb.get_task(conn, queued["tasks"][0]["task_id"])
    assert task is not None
    assert task.skills == ["ultimate-builder:sw-developer"]


def test_reopening_chat_reuses_existing_phase_job(tmp_path, monkeypatch):
    monkeypatch.setenv("HERMES_KANBAN_HOME", str(tmp_path / "hermes"))
    project = tmp_path / "project"
    project.mkdir()
    module = load_project_runs()

    first = module.queue_project_run(project, ["sw-developer"])
    second = module.queue_project_run(project, ["sw-developer"])

    assert second["tasks"][0]["task_id"] == first["tasks"][0]["task_id"]
    assert second["tasks"][0]["reused"] is True


def test_development_phase_materializes_small_dependency_ordered_jobs(
    tmp_path, monkeypatch
):
    monkeypatch.setenv("HERMES_KANBAN_HOME", str(tmp_path / "hermes"))
    project = tmp_path / "project"
    project.mkdir()
    (project / "task-graph.md").write_text(
        """# Build plan

### TG-001 — Build account storage
**Depends on:** architecture approval.
**Work:** Implement only account storage and its tests.

### TG-002 — Add the account route
**Depends on:** TG-001.
**Work:** Implement only the account route and its tests.

### TG-003 — Add the account screen
**Depends on:** TG-002.
**Work:** Implement only the account screen and its tests.
""",
        encoding="utf-8",
    )
    module = load_project_runs()

    queued = module.queue_project_run(
        project, ["sw-developer", "code-reviewer"]
    )

    development = [task for task in queued["tasks"] if task["phase"] == "sw-developer"]
    assert [task["work_item_id"] for task in development] == [
        "TG-001",
        "TG-002",
        "TG-003",
    ]
    assert [task["status"] for task in development] == ["ready", "todo", "todo"]
    assert queued["work_plan"] == {
        "source": "task-graph.md",
        "unit_count": 3,
        "accepted_units_skipped": [],
    }
    review = queued["tasks"][-1]
    assert review["phase"] == "code-reviewer"
    with module.kb.connect_closing() as conn:
        first = module.kb.get_task(conn, development[0]["task_id"])
        second = module.kb.get_task(conn, development[1]["task_id"])
        third = module.kb.get_task(conn, development[2]["task_id"])
        review_task = module.kb.get_task(conn, review["task_id"])
        parent_ids = lambda task_id: [
            row["parent_id"]
            for row in conn.execute(
                "SELECT parent_id FROM task_links WHERE child_id=? ORDER BY parent_id",
                (task_id,),
            ).fetchall()
        ]
        second_parents = parent_ids(second.id)
        third_parents = parent_ids(third.id)
        review_parents = parent_ids(review_task.id)
    assert "Current work item: TG-001 — Build account storage" in first.body
    assert "Do not mark the whole Development phase" in first.body
    assert second_parents == [first.id]
    assert third_parents == [second.id]
    assert set(review_parents) == {task["task_id"] for task in development}


def test_development_skips_units_with_latest_accepted_evidence(tmp_path, monkeypatch):
    monkeypatch.setenv("HERMES_KANBAN_HOME", str(tmp_path / "hermes"))
    project = tmp_path / "project"
    project.mkdir()
    (project / "task-graph.md").write_text(
        """### TG-001 — Finished foundation
**Depends on:** none.

### TG-002 — Build the next slice
**Depends on:** TG-001.
""",
        encoding="utf-8",
    )
    evidence = project / ".sdlc" / "evidence" / "tasks"
    evidence.mkdir(parents=True)
    (evidence / "TG-001.txt").write_text("Final verdict: ACCEPTED\n", encoding="utf-8")
    module = load_project_runs()

    queued = module.queue_project_run(project, ["sw-developer"])

    assert queued["work_plan"]["accepted_units_skipped"] == ["TG-001"]
    assert [task["work_item_id"] for task in queued["tasks"]] == ["TG-002"]
    assert queued["tasks"][0]["status"] == "ready"


def test_unstarted_broad_development_is_replaced_without_bypassing_review(
    tmp_path, monkeypatch
):
    monkeypatch.setenv("HERMES_KANBAN_HOME", str(tmp_path / "hermes"))
    project = tmp_path / "project"
    project.mkdir()
    module = load_project_runs()
    legacy = module.queue_project_run(
        project, ["sw-developer", "code-reviewer"]
    )["tasks"]
    broad = legacy[0]
    review = legacy[1]
    (project / "task-graph.md").write_text(
        """### TG-001 — Build storage
**Depends on:** none.

### TG-002 — Build route
**Depends on:** TG-001.
""",
        encoding="utf-8",
    )
    replacement = module.queue_project_run(project, ["sw-developer"])
    bounded = replacement["tasks"]

    with module.kb.connect_closing() as conn:
        assert module.kb.get_task(conn, broad["task_id"]).status == "archived"
        assert module.kb.get_task(conn, review["task_id"]).status == "todo"
        review_parents = {
            row["parent_id"]
            for row in conn.execute(
                "SELECT parent_id FROM task_links WHERE child_id=?",
                (review["task_id"],),
            ).fetchall()
        }

    state = module.project_run_state(project)

    bounded_ids = {task["task_id"] for task in bounded}
    assert replacement["superseded_tasks"] == [broad["task_id"]]
    assert bounded_ids.issubset(review_parents)
    assert broad["task_id"] in review_parents
    visible_development = [
        task for task in state["tasks"] if task["phase"] == "sw-developer"
    ]
    assert {task["task_id"] for task in visible_development} == bounded_ids
    assert all(task["work_item_id"] for task in visible_development)


def test_reused_phase_replaces_or_clears_stale_model_routing(tmp_path, monkeypatch):
    monkeypatch.setenv("HERMES_KANBAN_HOME", str(tmp_path / "hermes"))
    project = tmp_path / "project"
    project.mkdir()
    module = load_project_runs()

    first = module.queue_project_run(
        project,
        ["sw-developer"],
        models={"sw-developer": "glm-5-2:cloud"},
        providers={"sw-developer": "ollama-local"},
    )
    task_id = first["tasks"][0]["task_id"]
    reused = module.queue_project_run(
        project,
        ["sw-developer"],
        models={"sw-developer": "claude-sonnet-4-6"},
        providers={"sw-developer": "claude-cli"},
    )
    assert reused["tasks"][0]["task_id"] == task_id
    with module.kb.connect_closing() as conn:
        task = module.kb.get_task(conn, task_id)
    assert task is not None
    assert task.model_override == "claude-sonnet-4-6"
    assert task.provider_override == "claude-cli"

    module.queue_project_run(project, ["sw-developer"])
    with module.kb.connect_closing() as conn:
        task = module.kb.get_task(conn, task_id)
    assert task is not None
    assert task.model_override is None
    assert task.provider_override is None


@pytest.mark.parametrize(
    ("models", "providers", "missing"),
    [
        ({"sw-developer": "glm-5-2:cloud"}, {}, "provider"),
        ({}, {"sw-developer": "ollama-local"}, "model"),
    ],
)
def test_queue_rejects_incomplete_model_routing(
    tmp_path, monkeypatch, models, providers, missing
):
    monkeypatch.setenv("HERMES_KANBAN_HOME", str(tmp_path / "hermes"))
    project = tmp_path / "project"
    project.mkdir()
    module = load_project_runs()

    with pytest.raises(ValueError, match=missing):
        module.queue_project_run(
            project,
            ["sw-developer"],
            models=models,
            providers=providers,
        )

    assert module.project_run_state(project)["tasks"] == []


def test_confirmed_routing_repairs_existing_blocked_job(tmp_path, monkeypatch):
    monkeypatch.setenv("HERMES_KANBAN_HOME", str(tmp_path / "hermes"))
    project = tmp_path / "project"
    project.mkdir()
    module = load_project_runs()
    queued = module.queue_project_run(
        project,
        ["sw-developer"],
        models={"sw-developer": "glm-5-2:cloud"},
        providers={"sw-developer": "ollama-local"},
    )
    task_id = queued["tasks"][0]["task_id"]
    with module.kb.connect_closing() as conn:
        assert module.kb.claim_task(conn, task_id)
        assert module.kb.block_task(
            conn, task_id, reason="Model unavailable", kind="capability"
        )

    result = module.sync_project_run_routing(
        project,
        ["sw-developer"],
        models={"sw-developer": "claude-sonnet-4-6"},
        providers={"sw-developer": "claude-cli"},
    )
    assert result["changed"] == [task_id]
    with module.kb.connect_closing() as conn:
        task = module.kb.get_task(conn, task_id)
    assert task is not None
    assert task.model_override == "claude-sonnet-4-6"
    assert task.provider_override == "claude-cli"


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
