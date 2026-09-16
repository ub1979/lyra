"""Is the agent already running the provider config.yaml names?

A named ``providers:`` entry such as ``ollama-local`` is built into the agent
as its *resolved class* (``provider="custom"``) plus its endpoint, while a
later ``switch_model`` stores the *name* on the agent. Comparing the raw
strings therefore said "different" on the first turn of every Studio session
and triggered a needless model switch (and its history note).
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Optional
from urllib.parse import urlsplit

ResolvedIdentity = tuple[str, str]
"""(resolved provider class, base_url) for a configured provider name."""


def same_provider_identity(
    configured: Optional[str],
    agent_provider: Optional[str],
    agent_base_url: Optional[str],
    resolve: Callable[[str], Optional[ResolvedIdentity]],
) -> bool:
    """True when ``configured`` names the provider the agent is already using.

    Three ways to be the same, checked in order:
    1. config expresses no provider preference;
    2. the names match (the agent was switched to this name before);
    3. the configured name resolves to the agent's provider class *and* the
       agent's endpoint — the class alone is shared by every custom entry, so
       the endpoint is what tells ``ollama-local`` from ``lmstudio``.
    A resolver failure falls back to the name comparison.
    """
    wanted = (configured or "").strip().lower()
    if not wanted:
        return True
    have = (agent_provider or "").strip().lower()
    if wanted == have:
        return True
    try:
        resolved = resolve(configured or "")
    except Exception:
        return False
    if not resolved:
        return False
    resolved_class, resolved_url = resolved
    return (
        (resolved_class or "").strip().lower() == have
        and _same_endpoint(resolved_url, agent_base_url)
    )


def _same_endpoint(left: Optional[str], right: Optional[str]) -> bool:
    def normalize(url: Optional[str]) -> tuple:
        parsed = urlsplit((url or "").strip())
        return (
            parsed.scheme.lower(), parsed.hostname, parsed.port,
            parsed.username, parsed.password, parsed.path.rstrip("/"),
            parsed.query, parsed.fragment,
        )

    try:
        return bool(left and left.strip()) and normalize(left) == normalize(right)
    except ValueError:
        return False
