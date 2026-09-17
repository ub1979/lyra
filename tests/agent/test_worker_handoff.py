"""Budget guidance must preserve cache prefixes and existing tool contracts."""

from copy import deepcopy
from types import SimpleNamespace

import pytest

from agent.iteration_budget import IterationBudget
from agent.worker_handoff import annotate_handoff_budget, exhaustion_handoff


def worker(used=78):
    budget = IterationBudget(90)
    for _ in range(used):
        budget.consume()
    return SimpleNamespace(
        max_iterations=90, _api_call_count=used, iteration_budget=budget
    )


def test_notice_leaves_prefix_and_tool_identity_intact(monkeypatch):
    monkeypatch.setenv("HERMES_KANBAN_TASK", "t_test")
    prefix = [
        {"role": "system", "content": "stable"},
        {"role": "tool", "content": "old result"},
    ]
    before = deepcopy(prefix)
    message = {
        "role": "tool",
        "name": "terminal",
        "tool_call_id": "call_1",
        "content": "passed",
    }
    agent = worker()
    annotate_handoff_budget(agent, message)
    assert "12 model calls remain" in message["content"]
    assert "kanban_comment" in message["content"]
    assert message["content"].startswith("passed")
    assert message["tool_call_id"] == "call_1" and message["role"] == "tool"
    assert prefix == before
    sibling = {"name": "read_file", "content": "sibling"}
    annotate_handoff_budget(agent, sibling)
    assert sibling["content"] == "sibling"


@pytest.mark.parametrize(
    "name,used",
    [("terminal", 10), ("kanban_complete", 89), ("kanban_block", 89), ("terminal", 90)],
)
def test_no_early_or_terminal_annotation(monkeypatch, name, used):
    monkeypatch.setenv("HERMES_KANBAN_TASK", "t_test")
    message = {"name": name, "content": '{"ok":true}'}
    annotate_handoff_budget(worker(used), message)
    assert message["content"] == '{"ok":true}'


def test_regular_chat_unchanged(monkeypatch):
    monkeypatch.delenv("HERMES_KANBAN_TASK", raising=False)
    message = {"name": "terminal", "content": "ok"}
    annotate_handoff_budget(worker(), message)
    assert message["content"] == "ok"


def test_multimodal_result_keeps_images(monkeypatch):
    monkeypatch.setenv("HERMES_KANBAN_TASK", "t_test")
    image = {"type": "image_url", "image_url": {"url": "data:test"}}
    original = [image]
    message = {"name": "browser", "content": original}
    annotate_handoff_budget(worker(), message)
    assert original == [image]
    assert message["content"][0] == image
    assert message["content"][1]["type"] == "text"


def test_summary_bounded_and_not_a_verdict():
    result = exhaustion_handoff("x" * 10000)
    assert "NOT completion" in result and len(result) < 6500
    assert exhaustion_handoff(None) is None
