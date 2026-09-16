"""Keep the Studio coordinator's context small: bound tool results, prune old ones.

The coordinator is a conversation that interviews the user and dispatches
specialists; it must never accumulate the specialists' raw output. One saved
project chat reached ~571k tokens of which 90 % was tool output the
coordinator had pulled in itself. Two existing Hermes mechanisms handle this
once they are pointed at the coordinator: the tool-result ``BudgetConfig``
(per result and per turn) and the compressor's proactive pruning of old tool
results, which ships disabled. Workers and delegated children keep the normal
budget because the marker is set on the coordinator's agent object only and
is never passed to a child constructor.
"""

from __future__ import annotations

from typing import Any, Iterable

from tools.budget_config import BudgetConfig

from tui_gateway.studio_model_routing import is_studio_coordinator

COORDINATOR_RESULT_CHARS = 8_000
COORDINATOR_TURN_CHARS = 32_000
COORDINATOR_INLINE_CAPS = {"read_file": 8_000, "search_files": 8_000}
COORDINATOR_PRUNE_MIN_RESULT_CHARS = 2_000
_PRUNE_WINDOW_FRACTION = 0.4
_PRUNE_FALLBACK_TOKENS = 60_000

__all__ = ["coordinator_budget", "apply_coordinator_context_policy"]


def coordinator_budget(base: BudgetConfig) -> BudgetConfig:
    """Tighten a scaled budget to the coordinator's bounds; never loosen a small model's."""
    return BudgetConfig(
        default_result_size=min(base.default_result_size, COORDINATOR_RESULT_CHARS),
        turn_budget=min(base.turn_budget, COORDINATOR_TURN_CHARS),
        preview_size=min(base.preview_size, COORDINATOR_RESULT_CHARS),
        tool_overrides=dict(base.tool_overrides),
        inline_caps={**base.inline_caps, **COORDINATOR_INLINE_CAPS},
    )


def apply_coordinator_context_policy(agent: Any, skills: Iterable[str]) -> bool:
    """Mark the coordinator and switch on old-tool-result pruning for it alone."""
    coordinator = is_studio_coordinator(list(skills))
    agent._studio_coordinator = coordinator
    if not coordinator:
        return False
    compressor = getattr(agent, "context_compressor", None)
    if compressor is None:
        return True
    context_length = getattr(compressor, "context_length", None)
    threshold = (
        int(int(context_length) * _PRUNE_WINDOW_FRACTION)
        if isinstance(context_length, (int, float)) and context_length > 0
        else _PRUNE_FALLBACK_TOKENS
    )
    compressor.proactive_prune_tokens = threshold
    compressor.proactive_prune_min_result_chars = COORDINATOR_PRUNE_MIN_RESULT_CHARS
    return True
