"""Conservative project membership without treating dependency links as ownership."""

from pathlib import Path

from hermes_cli import kanban_db as kb


def same_workspace(path: str | None, project: Path) -> bool:
    return bool(path) and Path(path).expanduser().resolve(strict=False) == project


def project_tasks(conn, project: Path, *, include_archived: bool = True) -> list[kb.Task]:
    """Include exact workspace roots and exclusively attached isolated children.

    Both creation provenance and current links must agree. A later dependency
    link alone must never make Stop take over another project's worker.
    Archived roots remain anchors so their already-started children stay visible.
    """
    tasks = kb.list_tasks(conn, include_archived=True)
    owned = {task.id for task in tasks if same_workspace(task.workspace_path, project)}
    if not owned:
        return []
    project_ids = {task.project_id for task in tasks if task.id in owned and task.project_id}
    by_id = {task.id: task for task in tasks}
    # Inspect provenance only along this project's descendant links, not the
    # entire board's event history on every Studio status refresh.
    reachable, frontier = set(), list(owned)
    while frontier:
        for child in kb.child_ids(conn, frontier.pop()):
            if child not in reachable and child not in owned:
                reachable.add(child)
                frontier.append(child)
    candidates = []
    for task in (by_id[tid] for tid in reachable if tid in by_id):
        if task.id in owned or task.workspace_kind not in {"scratch", "worktree"}:
            continue
        if task.project_id and task.project_id not in project_ids:
            continue
        if task.workspace_kind == "worktree" and task.project_id not in project_ids:
            continue
        creation = next((e for e in kb.list_events(conn, task.id) if e.kind == "created"), None)
        payload = (creation.payload or {}) if creation else {}
        # Explicitly assigned directories are not implicit project children.
        if task.workspace_kind == "scratch" and payload.get("workspace_path"):
            continue
        original = set(payload.get("parents") or ())
        parents = set(kb.parent_ids(conn, task.id))
        if original and parents:
            candidates.append((task.id, original, parents))
    while True:
        additions = {tid for tid, original, parents in candidates
                     if original <= owned and parents <= owned} - owned
        if not additions:
            break
        owned.update(additions)
    return [task for task in tasks if task.id in owned
            and (include_archived or task.status != "archived")]
