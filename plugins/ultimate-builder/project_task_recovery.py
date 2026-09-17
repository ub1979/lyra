"""Recover one failed project task without bypassing its dependency/review gates."""

from pathlib import Path

from hermes_cli import kanban_db as kb
from hermes_cli.project_job_attention import task_attention


def retry_failed_task(project: Path, tasks, task_id: str, reason: str) -> dict:
    """Internal adapter; the public project-run boundary checks coordinator role.

    The event fence prevents a concurrent new block (especially review/input)
    from being cleared using an older recovery decision.
    """
    if not task_id or not reason.strip() or len(reason) > 2000:
        raise ValueError("retry needs one task_id and a recovery reason (1–2000 characters)")
    matches = [(board, task) for board, task in tasks if task.id == task_id]
    if len(matches) != 1:
        raise ValueError("Task must belong uniquely to the selected project")
    board, _ = matches[0]
    with kb.connect_closing(board=board) as conn:
        # Read the fence first: any later state change must invalidate recovery.
        events = kb.list_events(conn, task_id)
        if not events:
            raise ValueError("Missing task history; inspect the job before recovery")
        task = kb.get_task(conn, task_id)
        if task is None or Path(task.workspace_path or "").resolve() != project:
            raise ValueError("Task no longer belongs to the selected project")
        if task.status != "blocked":
            return {"ok": False, "changed": [], "error": "Only a blocked failed job can be retried"}
        attention = task_attention(conn, task)
        if attention["attention_kind"] in {"review", "input"}:
            raise ValueError("This job needs review or a user's answer, not a retry")
        # Log the reason in the same transaction as the state transition.
        changed = kb.unblock_task(
            conn, task_id, expected_event_id=events[-1].id,
            recovery_reason=reason.strip(),
        )
        state = kb.get_task(conn, task_id).status
    if changed:
        from hermes_cli.kanban_dispatch_wakeup import request_dispatch

        request_dispatch()
    return {
        "ok": changed, "action": "retry", "changed": [task_id] if changed else [],
        "task_id": task_id, "status": state, "project": str(project),
        "note": "Dependencies still apply; retry is not completion.",
    }
