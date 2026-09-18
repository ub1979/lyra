"""Low-budget guidance matches what goal-mode project jobs actually accept.

Trial 3: the reminder said "block with the remaining work", the worker called
kanban_block, and the goal-mode rule rejected it, wasting a call. The final
summary then became the retry's handoff without being asked for the facts a
retry needs.
"""

from types import SimpleNamespace

from agent.iteration_budget import IterationBudget
from agent.worker_handoff import annotate_handoff_budget, exhaustion_summary_request


def _worker(used=80):
    budget = IterationBudget(90)
    for _ in range(used):
        budget.consume()
    return SimpleNamespace(max_iterations=90, _api_call_count=used, iteration_budget=budget)


def _reminder():
    message = {"role": "tool", "name": "terminal", "tool_call_id": "c1", "content": "ok"}
    annotate_handoff_budget(_worker(), message)
    return message["content"]


def test_goal_mode_reminder_does_not_advise_a_rejected_block(monkeypatch):
    monkeypatch.setenv("HERMES_KANBAN_TASK", "t_goal")
    monkeypatch.setenv("HERMES_KANBAN_GOAL_MAX_TURNS", "12")

    text = _reminder()

    assert "do not call kanban_block for the call limit" in text
    assert "otherwise block with the remaining work" not in text
    assert "kanban_comment" in text


def test_classic_worker_keeps_the_block_advice(monkeypatch):
    monkeypatch.setenv("HERMES_KANBAN_TASK", "t_classic")
    monkeypatch.delenv("HERMES_KANBAN_GOAL_MAX_TURNS", raising=False)

    assert "otherwise block with the remaining work" in _reminder()


def test_worker_exhaustion_summary_asks_for_a_retry_handoff(monkeypatch):
    monkeypatch.setenv("HERMES_KANBAN_TASK", "t_goal")

    request = exhaustion_summary_request()

    assert "without calling any more tools" in request
    for fact in ("files you changed", "acceptance items", "test command", "next action"):
        assert fact in request


def test_ordinary_chat_summary_request_is_unchanged(monkeypatch):
    monkeypatch.delenv("HERMES_KANBAN_TASK", raising=False)

    request = exhaustion_summary_request()

    assert "without calling any more tools" in request
    assert "handoff" not in request
