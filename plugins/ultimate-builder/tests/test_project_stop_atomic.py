"""Real SQLite cancellation races and worker termination for project Stop."""

import importlib.util
import subprocess
import sys
import threading
from pathlib import Path

import pytest

from hermes_cli import kanban_db as kb


@pytest.fixture
def project(tmp_path, monkeypatch):
    monkeypatch.setenv("HERMES_HOME", str(tmp_path / "home"))
    monkeypatch.setenv("HERMES_KANBAN_HOME", str(tmp_path / "board"))
    monkeypatch.delenv("HERMES_KANBAN_TASK", raising=False)
    path = tmp_path / "project"
    path.mkdir()
    spec = importlib.util.spec_from_file_location(
        "stop_project_runs", Path(__file__).resolve().parents[1] / "project_runs.py",
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    with kb.connect_closing() as conn:
        qa = kb.create_task(conn, title="QA", assignee="default", workspace_kind="dir", workspace_path=str(path))
        repair = kb.create_task(conn, title="Repair", assignee="default", parents=[qa])
        kb.claim_task(conn, qa)
    return path, module, qa, repair


def test_stop_is_atomic_against_child_claim(project, monkeypatch):
    path, runs, qa, repair = project
    append = kb._append_event
    starting, finished = threading.Event(), threading.Event()
    claims, workers = [], []

    def dispatch():
        try:
            with kb.connect_closing() as conn:
                starting.set()
                kb.recompute_ready(conn)
                claims.append(kb.claim_task(conn, repair))
        finally:
            finished.set()

    def event(conn, task_id, kind, *args, **kwargs):
        append(conn, task_id, kind, *args, **kwargs)
        if task_id == qa and kind == "archived":
            # The parent update has happened, but it is not visible outside
            # this transaction. A real concurrent dispatcher must wait.
            with kb.connect_closing() as observer:
                assert kb.get_task(observer, qa).status == "running"
                assert kb.get_task(observer, repair).status == "todo"
            thread = threading.Thread(target=dispatch, daemon=True)
            workers.append(thread)
            thread.start()
            assert starting.wait(3)
            assert not finished.wait(0.05)

    monkeypatch.setattr(kb, "_append_event", event)
    result = runs.control_project_run(path, "stop")
    for thread in workers:
        thread.join(5)
        assert not thread.is_alive()
    assert result["ok"] and set(result["changed"]) == {qa, repair}
    assert claims == [None]
    with kb.connect_closing() as conn:
        assert kb.get_task(conn, qa).current_run_id is None
        assert all(task.status == "archived" for task in kb.list_tasks(conn, include_archived=True))
    assert runs.control_project_run(path, "stop")["changed"] == []


def test_archive_error_rolls_back_entire_stop(project, monkeypatch):
    path, runs, qa, repair = project
    append = kb._append_event

    def event(conn, task_id, kind, *args, **kwargs):
        if task_id == repair and kind == "archived":
            raise RuntimeError("simulated failed event write")
        return append(conn, task_id, kind, *args, **kwargs)

    monkeypatch.setattr(kb, "_append_event", event)
    with pytest.raises(RuntimeError, match="event write"):
        runs.control_project_run(path, "stop")
    with kb.connect_closing() as conn:
        assert kb.get_task(conn, qa).status == "running"
        assert kb.get_task(conn, qa).current_run_id
        assert kb.get_task(conn, repair).status == "todo"


def test_stop_terminates_real_worker_and_preserves_completed_evidence(project):
    path, runs, qa, repair = project
    worker = subprocess.Popen([sys.executable, "-c", "import time; time.sleep(60)"])
    try:
        with kb.connect_closing() as conn:
            kb._set_worker_pid(conn, qa, worker.pid)
            completed = kb.create_task(conn, title="Evidence", assignee="default", workspace_kind="dir", workspace_path=str(path))
            kb.claim_task(conn, completed)
            kb.complete_task(conn, completed, result="Prior evidence")
        result = runs.control_project_run(path, "stop")
        assert result["ok"] and result["unconfirmed_workers"] == []
        assert worker.wait(timeout=3) is not None
        with kb.connect_closing() as conn:
            assert kb.get_task(conn, completed).status == "done"
            event = next(e for e in kb.list_events(conn, qa) if e.kind == "project_stop_worker")
            assert event.payload["prev_pid"] == worker.pid
            assert event.payload["terminated"]
    finally:
        if worker.poll() is None:
            worker.kill()
        worker.wait(timeout=3)


def test_unconfirmed_exit_is_not_reported_as_success(project, monkeypatch):
    path, runs, qa, repair = project
    with kb.connect_closing() as conn:
        kb._set_worker_pid(conn, qa, 99999999)
    monkeypatch.setattr(kb, "_terminate_reclaimed_worker", lambda *a: {"terminated": False})
    result = runs.control_project_run(path, "stop")
    assert not result["ok"] and result["unconfirmed_workers"] == [qa]
    assert "unconfirmed" in result["error"]
    assert not runs.control_project_run(path, "stop")["ok"]
    with kb.connect_closing() as conn:
        assert kb.get_task(conn, repair).status == "archived"
