"""Validate a dependency wait against the board's actual prerequisite edges."""

import sqlite3


def require_unfinished_prerequisite(conn: sqlite3.Connection, task_id: str) -> None:
    """Called inside the block transaction, before the active run is released.

    A reason string is not a dependency. Children wait for this task; only an
    unfinished parent can keep this task asleep during dispatcher promotion.
    """
    waiting = conn.execute(
        "SELECT 1 FROM task_links l JOIN tasks t ON t.id=l.parent_id "
        "WHERE l.child_id=? AND t.status NOT IN ('done', 'archived') LIMIT 1",
        (task_id,),
    ).fetchone()
    if waiting is None:
        raise ValueError(
            "dependency block requires an unfinished prerequisite linked as a "
            "parent of this task. A child waits for you, not the reverse. "
            "Have the coordinator link the prerequisite -> this task, or use "
            "kind='needs_input' with a handoff. The current run is unchanged."
        )
