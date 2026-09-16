"""Durable worker usage is saved per run, read in one query, and never enters prompts."""

import pytest

from hermes_cli import kanban_db as kb
from hermes_cli.kanban_usage import (
    latest_run_usage_by_task,
    record_run_usage,
    record_worker_run_usage_from_env,
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


def test_latest_record_wins_and_unreported_tasks_are_absent(board):
    first = kb.create_task(board, title="Architecture", assignee="default")
    second = kb.create_task(board, title="Development", assignee="default")
    never = kb.create_task(board, title="QA", assignee="default")
    with kb.write_txn(board):
        assert record_run_usage(board, first, usage_from_run_result(RESULT), run_id=1)
        assert record_run_usage(
            board, first, usage_from_run_result({**RESULT, "input_tokens": 5}), run_id=2
        )
        assert record_run_usage(board, second, usage_from_run_result(RESULT))
        assert record_run_usage(board, never, None) is False

    latest = latest_run_usage_by_task(board, [first, second, never, first])

    assert latest[first]["input_tokens"] == 5
    assert latest[second]["input_tokens"] == 1200
    assert never not in latest
    assert latest_run_usage_by_task(board, []) == {}


def test_worker_process_saves_usage_on_its_assigned_task(tmp_path, monkeypatch):
    monkeypatch.setenv("HERMES_KANBAN_HOME", str(tmp_path / "home"))
    with kb.connect_closing() as conn:
        task_id = kb.create_task(conn, title="Development", assignee="default")

    assert record_worker_run_usage_from_env(RESULT, {}) is False
    assert record_worker_run_usage_from_env(
        {"final_response": "no counters"}, {"HERMES_KANBAN_TASK": task_id}
    ) is False
    assert record_worker_run_usage_from_env(
        RESULT, {"HERMES_KANBAN_TASK": task_id, "HERMES_KANBAN_RUN_ID": "7"}
    )

    with kb.connect_closing() as conn:
        assert latest_run_usage_by_task(conn, [task_id])[task_id]["api_calls"] == 3
        usage_events = [e for e in kb.list_events(conn, task_id) if e.kind == "usage"]
    assert [event.run_id for event in usage_events] == [7]


def test_saved_usage_never_enters_child_worker_context(board):
    task_id = kb.create_task(board, title="Architecture", assignee="default")
    with kb.write_txn(board):
        record_run_usage(board, task_id, usage_from_run_result(RESULT))

    context = kb.build_worker_context(board, task_id)

    assert "worker-session-xyz" not in context
    assert "0.0125" not in context
    assert "pricing-table" not in context
