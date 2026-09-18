"""Per-profile call ceilings for Development jobs, and the task-plan requirement.

Plan revision 6, Slice 4b. A ceiling bounds one worker attempt, including its
goal-loop continuation turns (see ``agent/attempt_budget.py``). Personal keeps
the 90-call safety limit while the lean procedure is measured against a
60-call target. Reusable and Production ceilings apply to one planner-defined
work item, never to a whole application, so those profiles need a task plan
before Development.
"""

from __future__ import annotations

DEVELOPMENT_ATTEMPT_CALLS = {"personal": 90, "reusable": 90, "production": 180}
PLANNED_PROFILES = frozenset({"reusable", "production"})


def development_attempt_calls(build_profile: str | None) -> int | None:
    """Return the attempt ceiling for a Development job, or None for legacy."""
    return DEVELOPMENT_ATTEMPT_CALLS.get(str(build_profile or ""))


def missing_task_plan_refusal(
    build_profile: str | None,
    requested: list[str],
    *,
    has_work_units: bool,
    has_existing_development: bool,
) -> str | None:
    """Refuse a whole-application Development job for a planned profile.

    Personal is exempt because one whole-app worker is its chosen design.
    Legacy projects (no profile) and projects that already have Development
    work keep their existing behavior.
    """
    if (
        "sw-developer" not in requested
        or build_profile not in PLANNED_PROFILES
        or has_work_units
        or has_existing_development
    ):
        return None
    return (
        "A Reusable or Production project builds from a task plan, one work item "
        "per job. Queue Task planning first (phases=\"task-planner\"), get the "
        "plan approved, then queue Development on its own."
    )
