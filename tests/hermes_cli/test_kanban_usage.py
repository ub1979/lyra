"""Durable worker usage is saved per run, read in one query, and never enters prompts."""

import pytest

from hermes_cli import kanban_db as kb
import types

from hermes_cli import kanban_usage
from hermes_cli.kanban_usage import (
    record_run_usage,
    record_worker_run_usage_from_env,
    record_worker_usage_snapshot,
    run_usage_totals_by_task,
    usage_from_agent,
    usage_from_run_result,
)

RESULT = {
    "final_response": "done",
    "input_tokens": 1200,
    "output_tokens": 300,
    "cache_read_tokens": 9000,
    "cache_write_tokens": 0,
    "reasoning_tokens": 40,
    "api_calls": 3,
    "estimated_cost_usd": 0.0125,
    "cost_status": "estimated",
    "cost_source": "pricing-table",
    "model": "claude-opus-4-6",
    "session_id": "worker-session-xyz",
}


@pytest.fixture
def board(tmp_path, monkeypatch):
    monkeypatch.setenv("HERMES_KANBAN_HOME", str(tmp_path / "home"))
    with kb.connect_closing() as conn:
        yield conn


def test_result_without_counters_is_unknown_not_zero():
    assert usage_from_run_result({}) is None
    assert usage_from_run_result("plain text") is None
    assert usage_from_run_result({"final_response": "ok", "model": "m"}) is None


def test_result_counters_become_a_compact_payload():
    payload = usage_from_run_result(RESULT)
    assert payload["input_tokens"] == 1200
    assert payload["cache_read_tokens"] == 9000
    assert payload["api_calls"] == 3
    assert payload["cost_usd"] == 0.0125
    assert payload["cost_status"] == "estimated"
    assert payload["model"] == "claude-opus-4-6"
    assert payload["recorded_at"] > 0
    assert "final_response" not in payload


def test_unpriced_result_keeps_cost_unknown():
    payload = usage_from_run_result(
        {**RESULT, "estimated_cost_usd": 0, "cost_status": "unavailable"}
    )
    assert payload["cost_usd"] is None
    assert payload["cost_status"] == "unavailable"


def test_retries_add_up_and_unreported_tasks_are_absent(board):
    """1,000 tokens on attempt one plus 100 on the retry is 1,100 spent, not 100."""
    task_id = kb.create_task(board, title="Architecture", assignee="default")
    never = kb.create_task(board, title="QA", assignee="default")
    with kb.write_txn(board):
        assert record_run_usage(
            board, task_id,
            usage_from_run_result({**RESULT, "input_tokens": 1000, "session_id": "attempt-1"}),
            run_id=1,
        )
        assert record_run_usage(
            board, task_id,
            usage_from_run_result({**RESULT, "input_tokens": 100, "session_id": "attempt-2"}),
            run_id=2,
        )
        assert record_run_usage(board, never, None) is False

    totals = run_usage_totals_by_task(board, [task_id, never, task_id])

    assert totals[task_id]["input_tokens"] == 1100
    assert totals[task_id]["api_calls"] == 6
    assert totals[task_id]["attempts"] == 2
    assert totals[task_id]["cost_usd"] == pytest.approx(0.025)
    assert never not in totals
    assert run_usage_totals_by_task(board, []) == {}


def test_snapshots_of_one_session_never_double_count(board):
    task_id = kb.create_task(board, title="Development", assignee="default")
    with kb.write_txn(board):
        record_run_usage(board, task_id, usage_from_run_result({**RESULT, "input_tokens": 400}))
        record_run_usage(board, task_id, usage_from_run_result({**RESULT, "input_tokens": 900}))
        record_run_usage(
            board, task_id,
            usage_from_run_result({**RESULT, "input_tokens": 70, "estimated_cost_usd": 0,
                                   "cost_status": "unavailable", "session_id": "other"}),
        )

    total = run_usage_totals_by_task(board, [task_id])[task_id]

    assert total["input_tokens"] == 970
    assert total["attempts"] == 2
    assert total["cost_usd"] == pytest.approx(0.0125)
    assert total["cost_status"] == "partial"


def test_legacy_rows_without_session_fall_back_to_run_then_event(board):
    task_id = kb.create_task(board, title="Development", assignee="default")
    bare = {key: value for key, value in RESULT.items() if key != "session_id"}
    with kb.write_txn(board):
        record_run_usage(board, task_id, usage_from_run_result({**bare, "input_tokens": 10}), run_id=5)
        record_run_usage(board, task_id, usage_from_run_result({**bare, "input_tokens": 20}), run_id=5)
        record_run_usage(board, task_id, usage_from_run_result({**bare, "input_tokens": 300}))
        record_run_usage(board, task_id, usage_from_run_result({**bare, "input_tokens": 4000}))

    total = run_usage_totals_by_task(board, [task_id])[task_id]

    assert total["input_tokens"] == 20 + 300 + 4000
    assert total["attempts"] == 3


def test_live_snapshots_are_throttled_and_only_written_when_calls_advance(
    tmp_path, monkeypatch
):
    monkeypatch.setenv("HERMES_KANBAN_HOME", str(tmp_path / "home"))
    with kb.connect_closing() as conn:
        task_id = kb.create_task(conn, title="Development", assignee="default")
    env = {"HERMES_KANBAN_TASK": task_id}
    agent = _agent()

    assert record_worker_usage_snapshot(agent, {}, now=0) is False
    assert record_worker_usage_snapshot(agent, env, now=0) is True
    assert record_worker_usage_snapshot(agent, env, now=10) is False
    agent.session_api_calls += 1
    assert record_worker_usage_snapshot(agent, env, now=10) is False
    assert record_worker_usage_snapshot(agent, env, now=30) is True
    assert record_worker_usage_snapshot(agent, env, now=500) is False

    with kb.connect_closing() as conn:
        total = run_usage_totals_by_task(conn, [task_id])[task_id]
        rows = [e for e in kb.list_events(conn, task_id) if e.kind == "usage"]
    assert len(rows) == 2
    assert total["attempts"] == 1 and total["api_calls"] == 4


@pytest.mark.parametrize("failure", [False, OSError("temporarily unavailable")])
def test_failed_snapshot_is_retried_without_new_model_calls(board, monkeypatch, failure):
    task_id = kb.create_task(board, title="Development", assignee="default")
    env = {"HERMES_KANBAN_TASK": task_id}
    agent = _agent()
    real_write = kanban_usage.record_worker_run_usage_from_env

    def fail(*args):
        if isinstance(failure, Exception):
            raise failure
        return failure

    monkeypatch.setattr(kanban_usage, "record_worker_run_usage_from_env", fail)
    if isinstance(failure, Exception):
        with pytest.raises(OSError):
            record_worker_usage_snapshot(agent, env, now=0)
    else:
        assert not record_worker_usage_snapshot(agent, env, now=0)
    monkeypatch.setattr(kanban_usage, "record_worker_run_usage_from_env", real_write)
    assert not record_worker_usage_snapshot(agent, env, now=10)
    assert record_worker_usage_snapshot(agent, env, now=30)
    assert run_usage_totals_by_task(board, [task_id])[task_id]["api_calls"] == 3


def test_late_usage_and_separate_agents_are_not_suppressed(board):
    first = kb.create_task(board, title="First", assignee="default")
    second = kb.create_task(board, title="Second", assignee="default")
    agent = _agent()
    env = {"HERMES_KANBAN_TASK": first}
    assert record_worker_usage_snapshot(agent, env, now=0)
    agent.session_input_tokens += 500
    assert record_worker_usage_snapshot(agent, env, now=30)
    assert record_worker_usage_snapshot(_agent(), {"HERMES_KANBAN_TASK": second}, now=0)
    totals = run_usage_totals_by_task(board, [first, second])
    assert totals[first]["input_tokens"] == 1700
    assert totals[second]["input_tokens"] == 1200
    # Reusing an agent for a new assigned run must not reuse its suppression state.
    assert record_worker_usage_snapshot(agent, {"HERMES_KANBAN_TASK": second}, now=31)


def test_no_snapshot_before_first_model_call(board):
    task_id = kb.create_task(board, title="Development", assignee="default")
    agent = _agent()
    agent.session_api_calls = 0
    assert not record_worker_usage_snapshot(agent, {"HERMES_KANBAN_TASK": task_id}, now=0)
    assert run_usage_totals_by_task(board, [task_id]) == {}


def _agent(**overrides):
    return types.SimpleNamespace(
        session_input_tokens=1200,
        session_output_tokens=300,
        session_cache_read_tokens=9000,
        session_cache_write_tokens=0,
        session_reasoning_tokens=40,
        session_api_calls=3,
        session_estimated_cost_usd=0.0125,
        session_cost_status="estimated",
        session_cost_source="pricing-table",
        model="claude-opus-4-6",
        session_id="worker-session-xyz",
        **overrides,
    )


def test_agent_session_totals_count_every_turn_of_a_goal_loop():
    """The first turn's result goes stale; the agent's session counters do not."""
    agent = _agent()
    first = usage_from_agent(agent)
    agent.session_input_tokens += 5000
    agent.session_api_calls += 4
    second = usage_from_agent(agent)

    assert first["input_tokens"] == 1200 and first["api_calls"] == 3
    assert second["input_tokens"] == 6200 and second["api_calls"] == 7
    assert second["session_id"] == "worker-session-xyz"
    assert usage_from_agent(types.SimpleNamespace(model="m")) is None


def test_worker_process_saves_usage_on_its_assigned_task(tmp_path, monkeypatch):
    monkeypatch.setenv("HERMES_KANBAN_HOME", str(tmp_path / "home"))
    with kb.connect_closing() as conn:
        task_id = kb.create_task(conn, title="Development", assignee="default")

    assert record_worker_run_usage_from_env(usage_from_agent(_agent()), {}) is False
    assert record_worker_run_usage_from_env(None, {"HERMES_KANBAN_TASK": task_id}) is False
    assert record_worker_run_usage_from_env(
        usage_from_agent(_agent()),
        {"HERMES_KANBAN_TASK": task_id, "HERMES_KANBAN_RUN_ID": "7"},
    )

    with kb.connect_closing() as conn:
        assert run_usage_totals_by_task(conn, [task_id])[task_id]["api_calls"] == 3
        usage_events = [e for e in kb.list_events(conn, task_id) if e.kind == "usage"]
    assert [event.run_id for event in usage_events] == [7]


def test_worker_process_writes_to_its_assigned_board(tmp_path, monkeypatch):
    monkeypatch.setenv("HERMES_KANBAN_HOME", str(tmp_path / "home"))
    with kb.connect_closing(board="project-x") as conn:
        task_id = kb.create_task(conn, title="Development", assignee="default")

    assert record_worker_run_usage_from_env(
        usage_from_agent(_agent()),
        {"HERMES_KANBAN_TASK": task_id, "HERMES_KANBAN_BOARD": "project-x"},
    )

    with kb.connect_closing(board="project-x") as conn:
        assert task_id in run_usage_totals_by_task(conn, [task_id])
    with kb.connect_closing() as conn:
        assert run_usage_totals_by_task(conn, [task_id]) == {}


def test_saved_usage_never_enters_child_worker_context(board):
    task_id = kb.create_task(board, title="Architecture", assignee="default")
    with kb.write_txn(board):
        record_run_usage(board, task_id, usage_from_run_result(RESULT))

    context = kb.build_worker_context(board, task_id)

    assert "worker-session-xyz" not in context
    assert "0.0125" not in context
    assert "pricing-table" not in context
