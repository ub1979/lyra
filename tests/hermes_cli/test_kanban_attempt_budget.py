"""A task's attempt budget is stored, migrated and handed to its worker.

Plan revision 6, Slice 4b: a per-turn ``--max-turns`` alone does not bound a
goal-mode attempt, so the task carries ``max_agent_iterations`` and the
dispatcher passes it as both the worker's per-turn cap and the attempt budget.
"""

from __future__ import annotations

import sqlite3
from pathlib import Path

import pytest

from hermes_cli import kanban_db as kb


@pytest.fixture
def kanban_home(tmp_path, monkeypatch):
    home = tmp_path / ".hermes"
    home.mkdir()
    monkeypatch.setenv("HERMES_HOME", str(home))
    monkeypatch.setattr(Path, "home", lambda: tmp_path)
    kb.init_db()
    return home


def _spawn(task, home, monkeypatch):
    captured = {}

    class _FakeProc:
        pid = 4244

    def _fake_popen(cmd, **kwargs):
        captured["cmd"] = cmd
        captured["env"] = kwargs.get("env", {})
        return _FakeProc()

    monkeypatch.setattr("subprocess.Popen", _fake_popen)
    kb._default_spawn(task, str(home))
    return captured


def test_budget_round_trips_and_reaches_the_worker(kanban_home, monkeypatch):
    with kb.connect() as conn:
        task_id = kb.create_task(
            conn, title="bounded", assignee="default", goal_mode=True, max_agent_iterations=180,
        )
        task = kb.get_task(conn, task_id)

    assert task.max_agent_iterations == 180
    spawned = _spawn(task, kanban_home, monkeypatch)
    assert spawned["env"]["HERMES_KANBAN_ATTEMPT_MAX_CALLS"] == "180"
    flag = spawned["cmd"].index("--max-turns")
    assert spawned["cmd"][flag + 1] == "180"


def test_task_without_a_budget_keeps_the_classic_worker(kanban_home, monkeypatch):
    with kb.connect() as conn:
        task = kb.get_task(conn, kb.create_task(conn, title="plain", assignee="default"))

    assert task.max_agent_iterations is None
    spawned = _spawn(task, kanban_home, monkeypatch)
    assert "HERMES_KANBAN_ATTEMPT_MAX_CALLS" not in spawned["env"]
    assert "--max-turns" not in spawned["cmd"]


def test_existing_database_gains_the_column_without_losing_tasks(tmp_path, monkeypatch):
    home = tmp_path / ".hermes"
    home.mkdir()
    monkeypatch.setenv("HERMES_HOME", str(home))
    monkeypatch.setattr(Path, "home", lambda: tmp_path)
    kb.init_db()
    with kb.connect() as conn:
        task_id = kb.create_task(conn, title="old task", assignee="default")
    path = kb.kanban_db_path()
    raw = sqlite3.connect(path)
    raw.execute("ALTER TABLE tasks DROP COLUMN max_agent_iterations")
    raw.commit()
    raw.close()

    # A new process opening the old database runs migrations once.
    kb._INITIALIZED_PATHS.clear()
    with kb.connect() as conn:
        columns = {row[1] for row in conn.execute("PRAGMA table_info(tasks)")}
        task = kb.get_task(conn, task_id)
        new_id = kb.create_task(conn, title="new", assignee="default", max_agent_iterations=90)

        assert "max_agent_iterations" in columns
        assert task is not None and task.title == "old task"
        assert task.max_agent_iterations is None
        assert kb.get_task(conn, new_id).max_agent_iterations == 90
