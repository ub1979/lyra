"""Preserve unresolved approval reasons without changing legacy deny semantics."""

from __future__ import annotations


class ApprovalDenied(str):
    """Still equals 'deny' for every existing callback consumer; never consent."""

    def __new__(cls, reason: str):
        if reason not in {"unavailable", "timeout"}:
            raise ValueError("Unknown unresolved approval reason")
        instance = super().__new__(cls, "deny")
        instance.reason = reason
        return instance


def unresolved_approval_result(choice, pattern_key: str, description: str) -> dict | None:
    """Surface unavailable input distinctly while preserving fail-closed policy."""
    reason = getattr(choice, "reason", None)
    if reason not in {"unavailable", "timeout"}:
        return None
    detail = ("No interactive approval UI is available for this worker"
              if reason == "unavailable" else "Approval timed out without a user response")
    return {
        "approved": False,
        "user_consent": False,
        "outcome": reason,
        "status": "approval_required",
        "pattern_key": pattern_key,
        "description": description,
        "message": (
            f"BLOCKED: {detail}. The command was NOT approved or executed. "
            "Silence is not consent. Do not retry, rephrase or bypass this gate. "
            "If running a Kanban job, save the exact blocked action and handoff, "
            "then use kanban_block with kind=needs_input so the coordinator can "
            "explain the required permission. Otherwise ask through an interactive "
            "approval-capable session. No user denial has been recorded."
        ),
    }
