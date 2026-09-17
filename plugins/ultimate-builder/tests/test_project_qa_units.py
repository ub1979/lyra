"""Real Hermes dependency/retry behavior for Lyra's bounded QA assignments."""

import importlib.util
from pathlib import Path

import pytest


def load_runs():
    path = Path(__file__).resolve().parents[1] / "project_runs.py"
    spec = importlib.util.spec_from_file_location("qa_project_runs_test", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.fixture
def setup(tmp_path, monkeypatch):
    monkeypatch.setenv("HERMES_HOME", str(tmp_path / "home"))
    monkeypatch.setenv("HERMES_KANBAN_HOME", str(tmp_path / "board"))
    project = tmp_path / "project"
    project.mkdir()
    return load_runs(), project


def test_qa_reuses_hermes_gates_and_survives_reconnect(setup):
    module, project = setup
    queued = module.queue_project_run(project, ["qa-engineer", "tech-writer"])
    qa = [task for task in queued["tasks"] if task["phase"] == "qa-engineer"]
    assert [task["work_item_id"] for task in qa] == [
        "QA-001",
        "QA-002",
        "QA-003",
        "QA-004",
    ]
    assert [task["status"] for task in qa] == ["ready", "todo", "todo", "todo"]
    repeated = module.queue_project_run(project, ["qa-engineer"])
    assert [task["task_id"] for task in repeated["tasks"]] == [
        task["task_id"] for task in qa
    ]
    assert all(task["reused"] for task in repeated["tasks"])
    for index, row in enumerate(qa):
        with module.kb.connect_closing() as conn:
            task = module.kb.get_task(conn, row["task_id"])
            assert task.max_runtime_seconds == module.PHASE_MAX_RUNTIME_SECONDS
            assert task.goal_max_turns == module.PHASE_GOAL_MAX_TURNS
            assert task.max_retries == 2
            assert list(task.skills) == ["ultimate-builder:qa-engineer"]
            if index + 1 < len(qa):
                assert module.kb.claim_task(conn, qa[index + 1]["task_id"]) is None
            claimed = module.kb.claim_task(conn, task.id)
            assert claimed
            assert module.kb.complete_task(
                conn,
                task.id,
                summary=f"stage {index} evidence",
                expected_run_id=claimed.current_run_id,
            )
            module.kb.recompute_ready(conn)
    with module.kb.connect_closing() as conn:
        assert module.kb.claim_task(conn, queued["tasks"][-1]["task_id"])
        assert "stage 2 evidence" in module.kb.build_worker_context(
            conn, qa[-1]["task_id"]
        )


def test_failed_stage_does_not_unlock_later_checks(setup):
    module, project = setup
    qa = module.queue_project_run(project, ["qa-engineer"])["tasks"]
    with module.kb.connect_closing() as conn:
        run = module.kb.claim_task(conn, qa[0]["task_id"])
        module.kb._record_task_failure(
            conn,
            run.id,
            "Iteration budget exhausted",
            outcome="timed_out",
            release_claim=True,
            end_run=True,
            expected_run_id=run.current_run_id,
            run_summary="Next: finish isolated harness",
        )
    with module.kb.connect_closing() as conn:
        assert module.kb.claim_task(conn, qa[1]["task_id"]) is None
        assert "finish isolated harness" in module.kb.build_worker_context(conn, run.id)
        retry = module.kb.claim_task(conn, run.id)
        assert retry and retry.current_run_id != run.current_run_id
        assert module.kb.get_task(conn, run.id).consecutive_failures == 1


@pytest.mark.parametrize("status", ["running", "done"])
def test_existing_live_or_completed_broad_qa_not_duplicated(setup, status):
    module, project = setup
    with module.kb.connect_closing() as conn:
        task_id = module.kb.create_task(
            conn,
            title="legacy QA",
            assignee="default",
            workspace_kind="dir",
            workspace_path=str(project),
            idempotency_key=f"{module.TASK_KEY_PREFIX}{module._workspace_digest(project)}:qa-engineer:old",
        )
        module.kb.claim_task(conn, task_id)
        if status == "done":
            module.kb.complete_task(conn, task_id, summary="legacy complete")
    queued = module.queue_project_run(project, ["qa-engineer"])
    assert len(queued["tasks"]) == 1
    assert queued["tasks"][0]["task_id"] == task_id


def test_exhausted_legacy_qa_replaced_without_losing_downstream_gates(setup):
    module, project = setup
    with module.kb.connect_closing() as conn:
        task_id = module.kb.create_task(
            conn,
            title="legacy QA",
            assignee="default",
            max_retries=1,
            workspace_kind="dir",
            workspace_path=str(project),
            idempotency_key=f"{module.TASK_KEY_PREFIX}{module._workspace_digest(project)}:qa-engineer:old",
        )
        downstream = module.kb.create_task(
            conn, title="release", assignee="default", parents=(task_id,)
        )
        run = module.kb.claim_task(conn, task_id)
        module.kb._record_task_failure(
            conn,
            task_id,
            "Iteration budget exhausted",
            outcome="timed_out",
            release_claim=True,
            end_run=True,
            expected_run_id=run.current_run_id,
        )
    queued = module.queue_project_run(project, ["qa-engineer"])
    assert len(queued["tasks"]) == 4
    with module.kb.connect_closing() as conn:
        assert module.kb.get_task(conn, task_id).status == "archived"
        assert module.kb.claim_task(conn, downstream) is None
        parents = {
            row[0]
            for row in conn.execute(
                "SELECT parent_id FROM task_links WHERE child_id=?", (downstream,)
            )
        }
        assert {row["task_id"] for row in queued["tasks"]} <= parents
