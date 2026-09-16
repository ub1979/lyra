"""Cross-process wake-up changes latency, never queue ownership."""

import asyncio
import importlib.util
from pathlib import Path
import subprocess
import sys
import threading
import time

from hermes_cli import kanban_dispatch_wakeup as wake


def test_queue_and_resume_signal_after_sqlite_commit(tmp_path, monkeypatch):
    monkeypatch.setenv("HERMES_KANBAN_HOME", str(tmp_path / "home"))
    project = tmp_path / "project"
    project.mkdir()
    path = Path(__file__).resolve().parents[2] / "plugins/ultimate-builder/project_runs.py"
    spec = importlib.util.spec_from_file_location("wakeup_project_runs", path)
    runs = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(runs)
    states = []
    real_request = wake.request_dispatch

    def checked_request():
        # A separate connection must see the new state before the signal.
        states.append(runs.project_run_state(project)["tasks"])
        return real_request()

    monkeypatch.setattr(wake, "request_dispatch", checked_request)
    queued = runs.queue_project_run(project, ["sw-architect"])
    assert states[0][0]["task_id"] == queued["tasks"][0]["task_id"]
    runs.control_project_run(project, "pause")
    resumed = runs.control_project_run(project, "resume")
    assert resumed["changed"]
    assert len(states) == 2
    assert states[1][0]["status"] == "ready"


def test_real_daemon_wakes_on_request_during_tick(tmp_path, monkeypatch):
    from hermes_cli import kanban_db as kb

    monkeypatch.setenv("HERMES_KANBAN_HOME", str(tmp_path))
    stop = threading.Event()
    ticks = []

    def on_tick(result):
        ticks.append(result)
        if len(ticks) == 1:
            wake.request_dispatch()
        else:
            stop.set()

    runner = threading.Thread(target=kb.run_daemon, kwargs={
        "interval": 60, "max_spawn": 0, "stop_event": stop, "on_tick": on_tick,
    })
    runner.start()
    try:
        runner.join(timeout=3)
        assert len(ticks) == 2
        assert not runner.is_alive()
    finally:
        stop.set()
        runner.join(timeout=2)


def test_cross_process_request_is_visible_and_marker_has_no_payload(tmp_path, monkeypatch):
    monkeypatch.setenv("HERMES_KANBAN_HOME", str(tmp_path))
    before = wake.wake_token()
    subprocess.run([
        sys.executable, "-c",
        "from hermes_cli.kanban_dispatch_wakeup import request_dispatch; assert request_dispatch()",
    ], check=True, timeout=10)
    assert wake.wake_token() != before
    assert (tmp_path / "kanban" / ".dispatch-wakeup").read_bytes() == b""


def test_sync_wait_notices_request_during_tick(tmp_path, monkeypatch):
    monkeypatch.setenv("HERMES_KANBAN_HOME", str(tmp_path))
    observed = wake.wake_token()
    wake.request_dispatch()
    start = time.monotonic()
    wake.wait_for_dispatch(threading.Event(), 60, observed)
    assert time.monotonic() - start < 1


def test_async_wait_wakes_after_request_and_can_be_cancelled(tmp_path, monkeypatch):
    monkeypatch.setenv("HERMES_KANBAN_HOME", str(tmp_path))

    async def run():
        observed = wake.wake_token()
        waiter = asyncio.create_task(wake.wait_for_dispatch_async(lambda: True, 60, observed))
        await asyncio.sleep(0)  # let waiter enter the normal polling wait
        wake.request_dispatch()
        await asyncio.wait_for(waiter, timeout=2)
        waiter = asyncio.create_task(wake.wait_for_dispatch_async(lambda: True, 60, wake.wake_token()))
        await asyncio.sleep(0)
        waiter.cancel()
        import pytest
        with pytest.raises(asyncio.CancelledError):
            await waiter
    asyncio.run(run())


def test_bad_marker_falls_back_and_stop_is_immediate(tmp_path, monkeypatch):
    monkeypatch.setenv("HERMES_KANBAN_HOME", str(tmp_path))
    (tmp_path / "kanban").write_text("not a directory", encoding="utf-8")
    assert wake.request_dispatch() is False
    assert wake.wake_token() is None
    stop = threading.Event()
    stop.set()
    wake.wait_for_dispatch(stop, 60, None)
    asyncio.run(wake.wait_for_dispatch_async(lambda: False, 60, None))
    # No signal still reaches the configured periodic poll instead of hanging.
    wake.wait_for_dispatch(threading.Event(), 0.01, None)
