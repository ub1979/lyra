"""Decide which saved-job updates may spend a model turn in the Studio conversation.

Every durable job event used to become a full coordinator turn: one project
chat absorbed 159 of them, each re-reading the whole context. A finished
phase needs a turn (that is how Lyra advances to the next specialist) and so
does a job waiting on a decision. A failed attempt that the dispatcher has
already re-queued, or a "blocked" event whose task has since moved on, is
information for the user, not a decision for the model.
"""

from __future__ import annotations

from typing import Any

from hermes_cli.project_job_attention import (
    FINISHED_STATES,
    RETRY_EVENT_KINDS,
    WAITING_EVENT_KINDS,
    WAITING_STATES,
)

JOB_NOTICE_KIND = "project_job"
_DECISION_ATTENTION = {"review", "input", "blocked"}

__all__ = ["JOB_NOTICE_KIND", "job_notice_payload", "notification_requires_turn"]


def notification_requires_turn(evt: dict) -> bool:
    """True for a finished phase or a live decision; False for retries and stale blocks."""
    if evt.get("type") != "kanban_task":
        return True
    kind = str(evt.get("event_kind") or "")
    status = str(evt.get("task_status") or "")
    if evt.get("attention_kind") in _DECISION_ATTENTION:
        return True
    if kind in RETRY_EVENT_KINDS:
        return False
    if kind in WAITING_EVENT_KINDS or kind == "gave_up":
        # The event is only a decision while the task is still waiting on one.
        return status in WAITING_STATES
    if kind == "completed" or status in FINISHED_STATES:
        return True
    return status in WAITING_STATES


def job_notice_payload(evt: dict, text: str) -> dict[str, Any]:
    """A turn-free status frame the browser renders as one quiet chat line."""
    return {
        "kind": JOB_NOTICE_KIND,
        "text": text,
        "task_id": str(evt.get("task_id") or ""),
        "event_kind": str(evt.get("event_kind") or ""),
        "event_cursor": evt.get("event_cursor"),
        "task_status": str(evt.get("task_status") or ""),
    }
