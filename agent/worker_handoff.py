"""Early worker handoff guidance on new tool results, preserving cached history."""

from __future__ import annotations

import os

from agent.delegation_context import is_delegated_child_process_context


def annotate_handoff_budget(agent, tool_message: dict) -> None:
    """Annotate only a fresh result; no extra calls, messages or tool schemas.

    This is guidance, not a guarantee that the model writes a checkpoint.
    Hermes's existing comments/run summaries carry the durable handoff.
    """
    if not os.environ.get("HERMES_KANBAN_TASK") or is_delegated_child_process_context():
        return
    if tool_message.get("name") in {"kanban_complete", "kanban_block"}:
        return
    budget = getattr(agent, "iteration_budget", None)
    maximum = getattr(agent, "max_iterations", None)
    used = getattr(agent, "_api_call_count", None)
    if not isinstance(maximum, int) or not isinstance(used, int) or budget is None:
        return
    remaining = min(maximum - used, budget.remaining)
    reserve = min(12, max(2, maximum // 6))
    if not 0 < remaining <= reserve:
        return
    # At most three reminders per budget; parallel tools cannot multiply them.
    band = 2 if remaining <= 2 else 1 if remaining <= reserve // 2 else 0
    previous = getattr(agent, "_handoff_notice_stamp", None)
    if previous and previous[0] is budget and previous[1] >= band:
        return
    notice = (
        f"\n\n[Worker budget: {remaining} model calls remain. "
        "Use the remaining tools to save a handoff now via kanban_comment: "
        "current revision/dirty files, exact checks and evidence paths, unresolved "
        "findings, and the next concrete command. Do not restart broad setup or "
        "expand scope. Save the required report and verified scoped changes. "
        "Complete only with evidence; otherwise block with the remaining work. "
        "A summary is not a passing test or permission to skip verification.]"
    )
    content = tool_message.get("content")
    if isinstance(content, str):
        tool_message["content"] = content + notice
    elif isinstance(content, list):
        tool_message["content"] = [*content, {"type": "text", "text": notice.strip()}]
    else:
        return
    agent._handoff_notice_stamp = (budget, band)


def exhaustion_handoff(summary: object) -> str | None:
    """Bound a user-visible fallback summary; never save hidden reasoning."""
    if not isinstance(summary, str) or not summary.strip():
        return None
    return (
        "Budget-exhausted attempt: unverified handoff, NOT completion. "
        "Inspect retained files and task comments; recheck evidence against the "
        "current revision before continuing.\n\n" + summary.strip()[:6000]
    )
