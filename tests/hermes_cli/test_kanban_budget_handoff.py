"""Real SQLite failure, reconnect and stale-attempt handoff invariants."""

import pytest

from hermes_cli import kanban_db as kb
from agent.worker_handoff import exhaustion_handoff


@pytest.mark.parametrize("limit,expected", [(2, "ready"), (1, "blocked")])
def test_exhaustion_summary_survives_reconnect_and_enters_retry_context(
    tmp_path, monkeypatch, limit, expected
):
    monkeypatch.setenv("HERMES_HOME", str(tmp_path / "home"))
    monkeypatch.setenv("HERMES_KANBAN_HOME", str(tmp_path / "board"))
    with kb.connect_closing() as conn:
        task_id = kb.create_task(
            conn, title="bounded check", assignee="default", max_retries=limit
        )
        claimed = kb.claim_task(conn, task_id)
        assert claimed
        run_id = claimed.current_run_id
        summary = exhaustion_handoff(
            "Evidence: checks/api.txt. Next: run browser smoke."
        )
        kb._record_task_failure(
            conn,
            task_id,
            "Iteration budget exhausted",
            outcome="timed_out",
            release_claim=True,
            end_run=True,
            run_summary=summary,
            expected_run_id=run_id,
        )
    with kb.connect_closing() as conn:
        assert kb.get_task(conn, task_id).status == expected
        assert kb.get_run(conn, run_id).summary == summary
        context = kb.build_worker_context(conn, task_id)
        assert "checks/api.txt" in context and "NOT completion" in context
        assert kb.get_task(conn, task_id).consecutive_failures == 1
        # Late duplicate finalization must not spend another retry.
        kb._record_task_failure(
            conn,
            task_id,
            "late",
            outcome="timed_out",
            release_claim=True,
            end_run=True,
            expected_run_id=run_id,
        )
        assert kb.get_task(conn, task_id).consecutive_failures == 1
        if expected == "ready":
            replacement = kb.claim_task(conn, task_id)
            kb._record_task_failure(
                conn,
                task_id,
                "stale worker",
                outcome="timed_out",
                release_claim=True,
                end_run=True,
                expected_run_id=run_id,
            )
            current = kb.get_task(conn, task_id)
            assert current.status == "running"
            assert current.current_run_id == replacement.current_run_id
            assert current.consecutive_failures == 1
