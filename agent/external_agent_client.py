"""Factory boundary for subprocess-backed model agents.

External agents expose the small ``chat.completions.create`` facade expected by
the Hermes conversation loop, while owning their native subprocess protocol.
Keeping the dispatch here prevents provider-specific subprocess checks from
spreading through the core runtime.
"""

from __future__ import annotations

from typing import Any


EXTERNAL_AGENT_PROVIDERS = frozenset({"copilot-acp", "claude-cli"})


def is_external_agent_provider(provider: str | None, base_url: str | None = None) -> bool:
    normalized = str(provider or "").strip().lower()
    marker = str(base_url or "").strip().lower()
    return normalized in EXTERNAL_AGENT_PROVIDERS or marker.startswith(
        ("acp://copilot", "claude-cli://")
    )


def create_external_agent_client(
    provider: str | None,
    client_kwargs: dict[str, Any],
) -> Any | None:
    """Create the matching external-agent facade, or ``None`` for API providers."""

    normalized = str(provider or "").strip().lower()
    base_url = str(client_kwargs.get("base_url") or "").strip().lower()

    if normalized == "claude-cli" or base_url.startswith("claude-cli://"):
        from agent.claude_cli_client import ClaudeCLIClient

        return ClaudeCLIClient(**client_kwargs)

    if normalized == "copilot-acp" or base_url.startswith("acp://copilot"):
        from agent.copilot_acp_client import CopilotACPClient

        return CopilotACPClient(**client_kwargs)

    return None
