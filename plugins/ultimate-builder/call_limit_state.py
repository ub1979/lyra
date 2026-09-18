"""Explain a project job that stopped at its model-call limit.

The runtime records the stop itself: it saves the worker's final summary as
the run's handoff and counts one failure. A project job allows one automatic
continuation (``PROJECT_JOB_MAX_RETRIES = 2`` attempts), which receives that
handoff; a second stop trips the existing breaker and blocks the job. Before
this module, the first stop showed as an ordinary healthy ``ready`` job.
"""

from __future__ import annotations

from typing import Any

_EXHAUSTED_MARKER = "iteration budget exhausted"

CONTINUING = "continuing"
NEEDS_DECISION = "needs_decision"

_MESSAGES = {
    CONTINUING: (
        "Stopped at its call limit. Lyra saved its handoff and one more attempt "
        "continues from it."
    ),
    NEEDS_DECISION: (
        "Stopped at its call limit again. Its work and handoff are saved; Lyra "
        "needs a decision before trying again."
    ),
}


def call_limit_state(status: str, last_failure_error: str | None) -> dict[str, Any] | None:
    """Return ``{"state", "message"}`` for a call-limit stop, or None."""
    if _EXHAUSTED_MARKER not in str(last_failure_error or "").casefold():
        return None
    if status in {"blocked", "triage"}:
        state = NEEDS_DECISION
    elif status in {"ready", "todo", "scheduled", "running"}:
        state = CONTINUING
    else:
        # done/archived: the later attempt finished or was superseded.
        return None
    return {"state": state, "message": _MESSAGES[state]}
