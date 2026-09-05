"""Explain automatic project-worker eligibility without changing Kanban state."""

from __future__ import annotations

from typing import TYPE_CHECKING

from hermes_cli.profiles import profile_exists

if TYPE_CHECKING:
    from hermes_cli.kanban_db import Task


def validate_project_worker(profile: str) -> None:
    """Lyra phase queues promise automatic execution, so require a real profile.

    Generic Hermes queues intentionally also support external worker names.
    This validation belongs only to Lyra's automatic project queue.
    """
    if not profile_exists(profile):
        raise ValueError(
            f"Worker profile {profile!r} does not exist. Choose an existing "
            "Hermes profile; specialist IDs belong in --phases, not --assignee."
        )


def project_job_dispatch_issue(task: Task) -> str:
    """Expose a waiting job's eligibility; never change or reassign it on read."""
    if task.status not in {"todo", "ready", "scheduled"} or task.claim_lock:
        return ""
    if not task.assignee:
        return "This job has no assigned worker. Ask Lyra to assign one so it can start."
    try:
        available = profile_exists(task.assignee)
    except ValueError:
        available = False
    if available:
        return ""
    return (
        "This job cannot start automatically with its assigned worker. "
        "Ask Lyra to correct the assignment, or connect the external worker "
        "if that assignment was intentional."
    )
