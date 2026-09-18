"""The preflight estimate follows provider replay without mutating history."""

from copy import deepcopy
from types import SimpleNamespace

from agent.agent_runtime_helpers import copy_reasoning_content_for_api
from agent.model_metadata import estimate_request_tokens_rough
from agent.request_token_projection import estimate_provider_request_tokens, projected_request_messages


def _agent(echo: bool):
    agent = SimpleNamespace(_needs_thinking_reasoning_pad=lambda: echo)
    agent._copy_reasoning_content_for_api = lambda source, outgoing: (
        copy_reasoning_content_for_api(agent, source, outgoing)
    )
    return agent


def test_custom_provider_ignores_stored_reasoning_but_keeps_real_request_content():
    history = [
        {"role": "user", "content": "clean", "api_content": "clean plus memory"},
        {"role": "assistant", "content": "answer", "reasoning": "x" * 100_000,
         "reasoning_content": "x" * 100_000, "display_kind": "reply"},
    ]
    before = deepcopy(history)
    projected = projected_request_messages(_agent(False), history)
    assert history == before
    assert projected == [
        {"role": "user", "content": "clean plus memory"},
        {"role": "assistant", "content": "answer"},
    ]
    tools = [{"type": "function", "function": {"name": "read_file", "description": "read"}}]
    estimate = estimate_request_tokens_rough(projected, system_prompt="system", tools=tools)
    assert estimate < estimate_request_tokens_rough(history, system_prompt="system", tools=tools) / 20


def test_echo_provider_keeps_required_reasoning_and_images():
    history = [
        {"role": "assistant", "content": "answer", "reasoning": "private analysis"},
        {"role": "user", "content": [
            {"type": "text", "text": "what is here?"},
            {"type": "image_url", "image_url": {"url": "data:image/png;base64," + "A" * 100_000}},
        ]},
    ]
    projected = projected_request_messages(_agent(True), history)
    assert projected[0] == {"role": "assistant", "content": "answer", "reasoning_content": "private analysis"}
    assert projected[1]["content"] == history[1]["content"]
    assert 1_500 <= estimate_request_tokens_rough(projected) < 4_000


def test_estimate_includes_ephemeral_system_prefill_and_tools_without_mutation():
    agent = _agent(False)
    agent.ephemeral_system_prompt = "ephemeral instructions " * 80
    agent.prefill_messages = [{"role": "assistant", "content": "prefill " * 80}]
    agent.tools = [{"type": "function", "function": {
        "name": "sample", "description": "tool schema " * 80,
    }}]
    history = [{"role": "user", "content": "hello"}]
    before = deepcopy(history)
    expected = estimate_request_tokens_rough(
        [*agent.prefill_messages, *projected_request_messages(agent, history)],
        system_prompt="stable\n\n" + agent.ephemeral_system_prompt,
        tools=agent.tools,
    )
    assert estimate_provider_request_tokens(agent, history, "stable") == expected
    assert history == before
