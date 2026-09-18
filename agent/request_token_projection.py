"""Provider-facing message projection for preflight token estimates.

The conversation keeps reasoning and display metadata for replay and history.
Compression must size the outgoing copy, not those stored-only fields.
"""

from __future__ import annotations

from typing import Any, Callable

from agent.model_metadata import estimate_request_tokens_rough

def projected_request_messages(agent: Any, messages: list[dict]) -> list[dict]:
    """Copy the fields that the ordinary chat request will replay.

    This intentionally leaves stored messages byte-for-byte unchanged. The
    provider echo helper is shared with request construction, so a fallback
    provider cannot be estimated using the primary provider's reasoning shape.
    """
    from agent.turn_context import substitute_api_content

    projected: list[dict] = []
    for message in messages:
        if not isinstance(message, dict):
            continue
        outgoing = message.copy()
        substitute_api_content(outgoing)
        for field in ("display_kind", "display_metadata", "finish_reason", "_thinking_prefill"):
            outgoing.pop(field, None)
        if outgoing.get("role") == "assistant":
            copier = getattr(agent, "_copy_reasoning_content_for_api", None)
            if callable(copier):
                copier(message, outgoing)
        outgoing.pop("reasoning", None)
        projected.append(outgoing)
    return projected


def estimate_provider_request_tokens(
    agent: Any,
    messages: list[dict],
    system_prompt: str,
    estimator: Callable[..., int] = estimate_request_tokens_rough,
) -> int:
    """Estimate the input shape replayed by the ordinary conversation loop.

    The compressor's threshold already reserves output tokens from the model
    window; this value remains input-only so the reserve is not counted twice.
    """
    outgoing = projected_request_messages(agent, messages)
    prefill = getattr(agent, "prefill_messages", None) or []
    if prefill:
        outgoing = [message.copy() for message in prefill] + outgoing
    ephemeral = getattr(agent, "ephemeral_system_prompt", None)
    if ephemeral:
        system_prompt = (system_prompt + "\n\n" + ephemeral).strip()
    return estimator(
        outgoing, system_prompt=system_prompt, tools=getattr(agent, "tools", None) or None,
    )
