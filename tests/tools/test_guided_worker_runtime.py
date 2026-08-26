from types import SimpleNamespace

from tools import delegate_tool
from tui_gateway import server


def test_interrupt_all_subagents_signals_each_live_child():
    calls: list[str] = []

    class Child:
        def __init__(self, name: str):
            self.name = name

        def interrupt(self, reason: str):
            calls.append(f"{self.name}:{reason}")

    with delegate_tool._active_subagents_lock:
        original = dict(delegate_tool._active_subagents)
        delegate_tool._active_subagents.clear()
        delegate_tool._active_subagents.update(
            {
                "sa-one": {"agent": Child("one")},
                "sa-two": {"agent": Child("two")},
            }
        )
    try:
        assert delegate_tool.interrupt_all_subagents() == 2
        assert {call.split(":", 1)[0] for call in calls} == {"one", "two"}
        assert all("Paused by user" in call for call in calls)
    finally:
        with delegate_tool._active_subagents_lock:
            delegate_tool._active_subagents.clear()
            delegate_tool._active_subagents.update(original)


def test_subagent_heartbeat_relays_semantic_usage_event():
    events: list[tuple] = []
    parent = SimpleNamespace(
        _delegate_spinner=None,
        tool_progress_callback=lambda *args, **kwargs: events.append((args, kwargs)),
    )
    callback = delegate_tool._build_child_progress_callback(
        0,
        "Implement the page",
        parent,
        subagent_id="sa-live",
        model="gpt-5.6-sol",
    )

    callback(
        "subagent.heartbeat",
        preview="running tests",
        input_tokens=1200,
        cache_read_tokens=5000,
        output_tokens=300,
        api_calls=4,
    )

    args, kwargs = events[-1]
    assert args[:3] == ("subagent.progress", None, "running tests")
    assert kwargs["subagent_id"] == "sa-live"
    assert kwargs["model"] == "gpt-5.6-sol"
    assert kwargs["input_tokens"] == 1200
    assert kwargs["cache_read_tokens"] == 5000
    assert kwargs["api_calls"] == 4


def test_session_usage_exposes_cache_and_estimated_cost(monkeypatch):
    monkeypatch.setattr("tools.async_delegation.active_count", lambda: 0)
    agent = SimpleNamespace(
        model="claude-opus-4-6",
        session_input_tokens=100,
        session_output_tokens=20,
        session_cache_read_tokens=900,
        session_cache_write_tokens=10,
        session_reasoning_tokens=5,
        session_prompt_tokens=100,
        session_completion_tokens=20,
        session_total_tokens=1025,
        session_api_calls=2,
        session_estimated_cost_usd=0.125,
        context_compressor=None,
    )

    usage = server._get_usage(agent)

    assert usage["cache_read"] == 900
    assert usage["cache_write"] == 10
    assert usage["cost_usd"] == 0.125
    assert usage["cost_status"] == "estimated"
