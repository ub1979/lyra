"""Choose Studio's coordinator capabilities once, at agent construction."""

from __future__ import annotations

from tui_gateway.studio_model_routing import is_studio_coordinator

# Bundles the default coding profile resolves to; they are *replaced* by
# ``project-guide``, which grants a subset (no terminal — dispatch runs through
# the ``project_run`` tool).
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


def studio_disabled_toolsets(skills: list[str]) -> list[str] | None:
    """Subtract worker execution capabilities even from explicit/custom bundles.

    This is a construction-time role boundary, not a security sandbox. Keep
    file editing for requirements and the user's selected memory/research tools.
    Workers retain their own construction policy and full execution tools.
    """
    if not is_studio_coordinator(skills):
        return None
    return ["terminal", "code_execution", "delegation"]


def studio_toolsets(
    skills: list[str], enabled: list[str] | None, *, explicit: bool = False
) -> list[str] | None:
    """Trim default bundles; explicit choices still get role exclusions separately.

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
