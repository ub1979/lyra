"""Choose Studio's coordinator capabilities once, at agent construction."""

from __future__ import annotations

from tui_gateway.studio_model_routing import is_studio_coordinator

_GUIDE_BUNDLES = frozenset({
    "web",
    "browser",
    "file",
    "terminal",
    "vision",
    "memory",
    "session_search",
    "clarify",
    "todo",
    "skills",
})
_WORKER_BUNDLES = frozenset({"code_execution", "delegation", "project"})


def studio_toolsets(
    skills: list[str], enabled: list[str] | None, *, explicit: bool = False
) -> list[str] | None:
    """Trim the default coding bundle, never an explicit choice or worker.

    Other configured bundles (including MCP/plugins) survive intact. Keeping
    this policy out of the turn loop preserves the cached tool-schema prefix.
    """
    if explicit or not is_studio_coordinator(skills) or not enabled:
        return enabled
    if "coding" in enabled:
        replaced = {"coding", "project"}
    elif _GUIDE_BUNDLES.issubset(enabled):
        # Normal Studio startup resolves the default CLI profile to component
        # bundles, not "coding". Require all guide capabilities so we never
        # re-enable one the user disabled. Optional/custom bundles are retained.
        replaced = _GUIDE_BUNDLES | _WORKER_BUNDLES
    else:
        return enabled
    return ["project-guide", *(name for name in enabled if name not in replaced)]
