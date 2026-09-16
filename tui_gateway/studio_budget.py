"""Bound Studio context through tool budgets and normal Hermes compression.

The coordinator is a conversation that interviews the user and dispatches
specialists; it must never accumulate the specialists' raw output. One saved
project chat reached ~571k tokens of which 90 % was tool output the
coordinator had pulled in itself. Two existing Hermes mechanisms handle this
once they are pointed at the coordinator: the tool-result ``BudgetConfig``
(per result and per turn) and summary compression with its memory handoff.
Workers and delegated children keep the normal
budget because the marker is set on the coordinator's agent object only and
is never passed to a child constructor.
"""

from __future__ import annotations

from typing import Any, Iterable

from tools.budget_config import BudgetConfig

from tui_gateway.studio_model_routing import is_studio_coordinator

COORDINATOR_RESULT_CHARS = 8_000
COORDINATOR_TURN_CHARS = 32_000
# read_file stays large enough for the documents the coordinator itself owns
# (a Project Brain runs ~15 KB); the 50 KB dumps that bloated sessions came
# from terminal, which the coordinator no longer has.
COORDINATOR_READ_FILE_CHARS = 24_000
COORDINATOR_INLINE_CAPS = {
    "read_file": COORDINATOR_READ_FILE_CHARS,
    "search_files": 8_000,
}
COORDINATOR_COMPRESSION_CAP_TOKENS = 100_000

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
    """Use normal, memory-aware compression instead of blind historical pruning."""
    coordinator = is_studio_coordinator(list(skills))
    agent._studio_coordinator = coordinator
    if not coordinator:
        return False
    compressor = getattr(agent, "context_compressor", None)
    if compressor is None:
        return True
    from agent.context_compressor import ContextCompressor

    if not isinstance(compressor, ContextCompressor):
        return True  # External engines own their lifecycle and retention policy.
    existing_cap = compressor.threshold_tokens_cap
    cap = min(existing_cap, COORDINATOR_COMPRESSION_CAP_TOKENS) if existing_cap else COORDINATOR_COMPRESSION_CAP_TOKENS
    compressor.threshold_tokens_cap = cap  # update_model() preserves this cap.
    compressor.threshold_tokens = min(compressor.threshold_tokens, cap)
    compressor.tail_token_budget = int(compressor.threshold_tokens * compressor.summary_target_ratio)
    compressor.proactive_prune_tokens = 0
    compressor.abort_on_summary_failure = True
    return True
