"""Carry a Kanban worker's model-call budget across goal-loop turns.

Each conversation turn normally gets a fresh ``IterationBudget`` of
``agent.max_iterations`` calls. A goal-mode worker receives judge
continuation prompts in the same session, so a per-turn limit alone lets one
"90-call" attempt make roughly 90 calls per continuation. When the dispatcher
sets ``HERMES_KANBAN_ATTEMPT_MAX_CALLS``, every turn of the attempt instead
receives only the calls that remain.

Judge and exhaustion-summary requests are not tool-calling iterations and do
not consume this budget.
"""

from __future__ import annotations

import os
from typing import Any, Mapping

from agent.iteration_budget import IterationBudget

ATTEMPT_ENV = "HERMES_KANBAN_ATTEMPT_MAX_CALLS"


def attempt_limit(environ: Mapping[str, str] = os.environ) -> int | None:
    """Return the attempt budget for this Kanban worker, or None."""
    if not environ.get("HERMES_KANBAN_TASK"):
        return None
    try:
        from agent.delegation_context import is_delegated_child_process_context

        if is_delegated_child_process_context():
            return None
    except Exception:
        pass
    try:
        value = int(str(environ.get(ATTEMPT_ENV) or "").strip())
    except ValueError:
        return None
    return value if value > 0 else None


def turn_call_limit(agent: Any, environ: Mapping[str, str] = os.environ) -> int:
    """Return how many model calls the turn that is starting may use.

    Calls already spent by earlier turns of this attempt are added up exactly
    once per budget object, so repeated calls cannot double count.
    """
    limit = attempt_limit(environ)
    if limit is None:
        return agent.max_iterations
    used = int(getattr(agent, "_attempt_calls_used", 0) or 0)
    previous = getattr(agent, "iteration_budget", None)
    if isinstance(previous, IterationBudget) and getattr(agent, "_attempt_counted_budget", None) is not previous:
        used += previous.used
        agent._attempt_counted_budget = previous
    agent._attempt_calls_used = used
    return max(0, limit - used)
