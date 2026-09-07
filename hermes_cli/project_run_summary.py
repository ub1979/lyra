"""Bounded, read-only projection of authoritative project job state."""

from __future__ import annotations

from collections import Counter
from typing import Any

_LIMIT = 8
_ACTIVE = frozenset({"running", "ready", "todo", "scheduled"})


def _brief(task: dict[str, Any]) -> dict[str, Any]:
    result = {
        key: task.get(key)
        for key in (
            "task_id",
            "board",
            "phase",
            "status",
            "activity_health",
            "last_activity_at",
            "activity_age_seconds",
            "attention_kind",
            "attention_id",
            "paused_by_user",
            "attempts",
        )
    }
    for key in ("label", "wait_reason", "dispatch_issue", "last_error"):
        text = str(task.get(key) or "")
        result[key] = text[:350]
        if len(text) > 350:
            result.setdefault("truncated_fields", []).append(key)
    return result


def summarize_project_run(state: dict[str, Any]) -> dict[str, Any]:
    """Keep total counts and attention even when the displayed job list is short.

    This describes jobs, not accepted product features. It neither caches stale
    liveness nor changes jobs/approvals; callers still read the real state first.
    """
    tasks = state.get("tasks", [])
    attention = [
        task
        for task in tasks
        if task.get("status") in {"blocked", "triage"}
        or task.get("attention_kind")
        or task.get("dispatch_issue")
        or task.get("activity_health") == "stalled"
    ]
    active = [task for task in tasks if task.get("status") in _ACTIVE]
    # Running work first, then newest queued work. Never hide a stalled worker
    # behind completed history or imply that a ready job has started.
    active.sort(
        key=lambda task: (
            task.get("status") != "running",
            -int(task.get("last_activity_at") or 0),
        )
    )
    completed = sorted(
        (task for task in tasks if task.get("status") == "done"),
        key=lambda task: int(task.get("last_activity_at") or 0),
        reverse=True,
    )
    result = {key: value for key, value in state.items() if key != "tasks"}
    result.update({
        "summary_only": True,
        "status_counts": dict(
            sorted(Counter(task.get("status", "unknown") for task in tasks).items())
        ),
        "attention_count": len(attention),
        "active_jobs": [_brief(task) for task in active[:_LIMIT]],
        "attention_jobs": [_brief(task) for task in attention[:_LIMIT]],
        "latest_completed": [_brief(task) for task in completed[:1]],
        "omitted": {
            "active_jobs": max(0, len(active) - _LIMIT),
            "attention_jobs": max(0, len(attention) - _LIMIT),
            "completed_jobs": max(0, len(completed) - 1),
        },
        "meaning": "Saved job status only; done is not verified product completion or user approval.",
        "details": "Use project-run status without --summary for all jobs; inspect the exact job and cited evidence before review or decisions.",
    })
    return result
