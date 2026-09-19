"""Real SQLite/tool regressions for invalid waits and one-shot valid resume."""

import json

import pytest

from hermes_cli import kanban_db as kb
from tools import kanban_tools


@pytest.fixture
def worker(tmp_path, monkeypatch):
    monkeypatch.setenv("HERMES_HOME", str(tmp_path / "home"))
    monkeypatch.setenv("HERMES_KANBAN_HOME", str(tmp_path / "board"))
    with kb.connect_closing() as conn:
        tid = kb.create_task(conn, title="QA", assignee="default", goal_mode=True)
        task = kb.claim_task(conn, tid)
    monkeypatch.setenv("HERMES_KANBAN_TASK", tid)
    monkeypatch.setenv("HERMES_KANBAN_RUN_ID", str(task.current_run_id))
    return task


@pytest.mark.parametrize("edge", ["none", "reversed", "done", "archived"])
def test_invalid_wait_preserves_claim_and_can_land_as_input(worker, edge):
    with kb.connect_closing() as conn:
        if edge != "none":
            repair = kb.create_task(conn, title="repair", assignee="default")
            if edge == "reversed":
                kb.link_tasks(conn, worker.id, repair)
            else:
                kb.link_tasks(conn, repair, worker.id)
                if edge == "done":
                    assert kb.claim_task(conn, repair)
                    assert kb.complete_task(conn, repair, result="done")
                else:
                    assert kb.archive_task(conn, repair)
        before = kb.get_task(conn, worker.id)
        events = kb.list_events(conn, worker.id)
    result = json.loads(kanban_tools._handle_block({
        "kind": "dependency", "reason": "needs repair",
    }))
    assert "unfinished prerequisite" in result["error"]
    with kb.connect_closing() as conn:
        assert kb.get_task(conn, worker.id) == before
        assert kb.list_events(conn, worker.id) == events
        for _ in range(3):
            kb.recompute_ready(conn)
            assert kb.claim_task(conn, worker.id) is None
    stopped = json.loads(kanban_tools._handle_block({
        "kind": "needs_input", "reason": "Coordinator: repair FR-006, then rerun J6",
    }))
    assert stopped["ok"] and stopped["status"] == "blocked"
    with kb.connect_closing() as conn:
        for _ in range(3):
            kb.recompute_ready(conn)
        assert kb.get_task(conn, worker.id).status == "blocked"
        assert kb.get_task(conn, worker.id).current_run_id is None


def test_real_prerequisite_waits_then_resumes_once_with_handoff(worker):
    with kb.connect_closing() as conn:
        repair = kb.create_task(conn, title="repair", assignee="default")
        kb.link_tasks(conn, repair, worker.id)
        kb.add_comment(conn, worker.id, "QA", "Recheck only J6 and affected regression tests")
    result = json.loads(kanban_tools._handle_block({
        "kind": "dependency", "reason": "Waiting for linked repair",
    }))
    assert result["ok"] and result["status"] == "todo"
    with kb.connect_closing() as conn:
        for _ in range(3):
            kb.recompute_ready(conn)
            assert kb.claim_task(conn, worker.id) is None
        assert kb.claim_task(conn, repair)
        assert kb.complete_task(conn, repair, result="Repair verified")
        resumed = kb.claim_task(conn, worker.id)
        assert resumed and resumed.current_run_id != worker.current_run_id
        assert kb.claim_task(conn, worker.id) is None
        assert "Recheck only J6" in kb.build_worker_context(conn, worker.id)
        assert not kb.block_task(conn, worker.id, kind="dependency",
                                 expected_run_id=worker.current_run_id)
