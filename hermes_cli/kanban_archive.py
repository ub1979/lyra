"""Archive a selected task set under the caller's existing write transaction."""

from __future__ import annotations

from hermes_cli import kanban_db as kb


def archive_in_transaction(conn, task_ids) -> list[kb.Task]:
    """Return pre-archive snapshots for termination after commit.

    No readiness recomputation occurs here: callers must archive the entire
    selected set before an archived parent can release any of its children.
    """
    if not conn.in_transaction:
        raise RuntimeError("Archiving a task set requires a write transaction")
    archived = []
    for task_id in dict.fromkeys(task_ids):
        task = kb.get_task(conn, task_id)
        if task is None or task.status == "archived":
            continue
        conn.execute(
            "UPDATE tasks SET status='archived', claim_lock=NULL, "
            "claim_expires=NULL, worker_pid=NULL WHERE id=?", (task_id,),
        )
        run_id = kb._end_run(
            conn, task_id, outcome="reclaimed", status="reclaimed",
            summary="task archived with run still active",
        )
        kb._append_event(conn, task_id, "archived", None, run_id=run_id)
        archived.append(task)
    return archived
