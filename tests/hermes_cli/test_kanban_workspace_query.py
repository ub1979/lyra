"""Project filtering uses a real indexed SQLite query, including old boards."""

from hermes_cli import kanban_db as kb


def test_workspace_query_is_exact_indexed_and_survives_reopen(tmp_path, monkeypatch):
    monkeypatch.setenv("HERMES_KANBAN_HOME", str(tmp_path / "boards"))
    first, sibling = str(tmp_path / "app"), str(tmp_path / "app-extra")
    with kb.connect_closing() as conn:
        own = kb.create_task(
            conn, title="Own", workspace_kind="dir", workspace_path=first
        )
        kb.create_task(
            conn, title="Sibling", workspace_kind="dir", workspace_path=sibling
        )
    with kb.connect_closing() as conn:
        assert [task.id for task in kb.list_tasks(conn, workspace_path=first)] == [own]
        plan = conn.execute(
            "EXPLAIN QUERY PLAN SELECT * FROM tasks WHERE workspace_path = ?", (first,)
        ).fetchall()
        assert any("idx_tasks_workspace_path" in row[3] for row in plan)
