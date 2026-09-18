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
        f"{_unfinished_work_instruction()} "
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


def _goal_mode_worker() -> bool:
    return bool(os.environ.get("HERMES_KANBAN_GOAL_MAX_TURNS"))


def _unfinished_work_instruction() -> str:
    """What to do if the work will not finish within the budget.

    Goal-mode tasks reject ``kanban_block`` for anything but a dependency or a
    user decision, so advising a block there wastes a call on a rejected tool
    (Trial 3). The runtime records the stop and saves the final summary itself.
    """
    if _goal_mode_worker():
        return (
            "Complete only with evidence. If the work will not finish, do not call "
            "kanban_block for the call limit: the runtime records the stop and the "
            "next attempt continues from your handoff."
        )
    return "Complete only with evidence; otherwise block with the remaining work."


def exhaustion_summary_request() -> str:
    """The toolless request sent when the call budget runs out.

    For a Kanban worker this summary becomes the retry's handoff, so ask for
    the facts the next attempt needs instead of a general recap.
    """
    base = (
        "You've reached the maximum number of tool-calling iterations allowed. "
        "Please provide a final response summarizing what you've found and "
        "accomplished so far, without calling any more tools."
    )
    if not os.environ.get("HERMES_KANBAN_TASK") or is_delegated_child_process_context():
        return base
    return base + (
        " This summary is the handoff for the next attempt at this job. List: "
        "the files you changed; which acceptance items are done and which are "
        "still open; the last test command and its result; and the exact next "
        "action. Do not claim anything is finished or verified unless you "
        "checked it."
    )


def exhaustion_handoff(summary: object) -> str | None:
    """Bound a user-visible fallback summary; never save hidden reasoning."""
    if not isinstance(summary, str) or not summary.strip():
        return None
    return (
        "Budget-exhausted attempt: unverified handoff, NOT completion. "
        "Inspect retained files and task comments; recheck evidence against the "
        "current revision before continuing.\n\n" + summary.strip()[:6000]
    )
