"""Cancel a whole project task set before releasing any dependency gates."""

from hermes_cli import kanban_db as kb
from hermes_cli.kanban_archive import archive_in_transaction


def stop_project_tasks(conn, project, scope) -> dict:
    # Scope selection and all terminal writes share the dispatcher claim lock.
    # Reclaim-then-archive per task would expose ready children between commits.
    with kb.write_txn(conn):
        tasks = scope.project_tasks(conn, project)
        archived = archive_in_transaction(
            conn, [task.id for task in tasks if task.status not in {"done", "archived"}],
        )
    unconfirmed = []
    for task in tasks:
        if task.status != "archived":
            continue
        last = next((e for e in reversed(kb.list_events(conn, task.id))
                     if e.kind == "project_stop_worker"), None)
        if last and not (last.payload or {}).get("terminated"):
            # Repeated Stop must not erase an earlier termination warning.
            # Do not signal an old PID again: it may since have been reused.
            unconfirmed.append(task.id)
    for task in archived:
        if not task.worker_pid:
            continue
        termination = kb._terminate_reclaimed_worker(task.worker_pid, task.claim_lock)
        # Preserve exact process identity and the result even on denied signal or
        # a remote worker. Do not equate a terminal database row with a dead PID.
        with kb.write_txn(conn):
            kb._append_event(conn, task.id, "project_stop_worker", termination,
                             run_id=task.current_run_id)
        if not termination.get("terminated"):
            unconfirmed.append(task.id)
    # Normal archive semantics still apply to *unselected* dependents. Never
    # steal a cross-project/shared task merely because it has a dependency.
    if archived:
        kb.recompute_ready(conn)
    return {"changed": [task.id for task in archived], "unconfirmed_workers": unconfirmed}
