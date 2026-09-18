"""The embedded dispatcher records a tick each loop, which Studio health reads."""

from __future__ import annotations

import asyncio
import os


def test_dispatcher_loop_records_a_tick_for_health_checks(monkeypatch, tmp_path):
    from gateway.run import GatewayRunner
    import hermes_cli.config as cfg
    import hermes_cli.kanban_db as kb
    from hermes_cli.kanban_dispatcher_tick import read_tick
    from hermes_cli.kanban_runner_health import job_runner_health

    monkeypatch.setenv("HERMES_KANBAN_HOME", str(tmp_path / "board"))
    monkeypatch.delenv("HERMES_KANBAN_DISPATCH_IN_GATEWAY", raising=False)
    monkeypatch.setattr(cfg, "load_config", lambda: {
        "kanban": {"dispatch_in_gateway": True, "dispatch_interval_seconds": 1},
    })
    monkeypatch.setattr(kb, "list_boards", lambda include_archived=False: [])

    runner = object.__new__(GatewayRunner)
    runner._running = True

    async def _to_thread(fn, *args, **kwargs):
        result = fn(*args, **kwargs)
        # Stop after the first full tick; the tick is written at its start.
        runner._running = False
        return result

    async def _sleep(_delay):
        return None

    monkeypatch.setattr("gateway.run.asyncio.to_thread", _to_thread)
    monkeypatch.setattr("gateway.run.asyncio.sleep", _sleep)

    asyncio.run(asyncio.wait_for(runner._kanban_dispatcher_watcher(), timeout=5.0))

    tick = read_tick()
    assert tick is not None and tick["pid"] == os.getpid()
    assert tick["interval_seconds"] == 1
    assert job_runner_health(gateway_pid=lambda: None)["state"] == "running"
