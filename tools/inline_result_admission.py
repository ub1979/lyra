"""Admit whole inline-capped results within a batch, never partial documents."""

from tools.budget_config import BudgetConfig

_DEFERRED = (
    "[Result omitted: batch context budget. Read the needed source separately "
    "before relying on it. Do not repeat side-effecting actions.]"
)


def admit_inline_results(messages: list[dict], config: BudgetConfig) -> None:
    """Bound only explicitly inline-capped results; ordinary spilling is separate.

    Call on newly collected results, never historical context. Reserve room for
    omission notices first, then admit whole results in call order. The source
    still exists: this is not a guess about which document is important.
    """
    capped = [
        msg for msg in messages
        if config.resolve_inline_cap(str(msg.get("name") or msg.get("tool_name") or "")) is not None
    ]
    budget = max(0, config.turn_budget)
    if not capped or sum(len(msg.get("content", "")) for msg in capped) <= budget:
        return
    # Pathological batches still have to fit; a zero-content tool reply is valid.
    notice = _DEFERRED[:budget // len(capped)]
    remaining = budget - sum(min(len(msg.get("content", "")), len(notice)) for msg in capped)
    for msg in capped:
        content = msg.get("content", "")
        extra = max(0, len(content) - len(notice))
        if extra <= remaining:
            remaining -= extra
        else:
            msg["content"] = notice
