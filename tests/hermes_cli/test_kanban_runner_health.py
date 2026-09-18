"""Job-runner health is running, unavailable or unknown, never optimistic.

Trial 3 evidence: a ready Development job sat unclaimed because no gateway was
running, while status reported no dispatch problem. The older presence probe
reports healthy whenever its own check fails.
"""

from __future__ import annotations

import os
import time

import pytest

from hermes_cli.kanban_dispatcher_tick import read_tick, record_tick
from hermes_cli.kanban_runner_health import job_runner_health


@pytest.fixture
def board_home(tmp_path, monkeypatch):
    monkeypatch.setenv("HERMES_KANBAN_HOME", str(tmp_path / "board"))
    monkeypatch.delenv("HERMES_KANBAN_DISPATCH_IN_GATEWAY", raising=False)
    return tmp_path / "board"


def _health(**overrides):
    deps = {
        "dispatch_enabled": lambda: True,
        "gateway_pid": lambda: None,
        "pid_alive": lambda _pid: True,
    }
    deps.update(overrides)
    return job_runner_health(**deps)


def test_tick_round_trips_through_the_real_file(board_home):
    record_tick(60, successful=True)

    tick = read_tick()

    assert tick["pid"] == os.getpid()
    assert tick["interval_seconds"] == 60
    assert abs(tick["at"] - time.time()) < 5


def test_fresh_tick_from_a_live_process_is_running(board_home):
    record_tick(60, successful=True)

    health = _health()

    assert health["state"] == "running"
    assert health["last_tick_at"] is not None


def test_real_process_check_accepts_this_live_process(board_home):
    record_tick(60, successful=True)

    assert job_runner_health(dispatch_enabled=lambda: True, gateway_pid=lambda: None)["state"] == "running"


def test_stale_tick_is_unknown_not_running(board_home):
    record_tick(10, successful=True)

    health = _health(now=time.time() + 2 * 10 + 31)

    assert health["state"] == "unknown"
    assert "not checked for work recently" in health["message"]


def test_no_tick_and_no_gateway_is_unavailable(board_home):
    health = _health()

    assert health["state"] == "unavailable"
    assert "cannot start yet" in health["message"]


def test_dead_tick_writer_and_no_gateway_is_unavailable(board_home):
    record_tick(60, successful=True)

    assert _health(pid_alive=lambda _pid: False)["state"] == "unavailable"


def test_live_gateway_without_ticks_is_unknown(board_home):
    """An older gateway, or one still starting, has not proven it dispatches."""
    assert _health(gateway_pid=lambda: 4242)["state"] == "unknown"


def test_dispatch_turned_off_is_unavailable(board_home):
    record_tick(60, successful=True)

    health = _health(dispatch_enabled=lambda: False)

    assert health["state"] == "unavailable"
    assert "turned off" in health["message"]


def test_env_override_turns_dispatch_off(board_home, monkeypatch):
    monkeypatch.setenv("HERMES_KANBAN_DISPATCH_IN_GATEWAY", "false")
    record_tick(60, successful=True)

    assert job_runner_health(gateway_pid=lambda: None)["state"] == "unavailable"


def test_a_failing_check_is_unknown_never_healthy(board_home):
    def broken():
        raise RuntimeError("probe failed")

    assert _health(gateway_pid=broken)["state"] == "unknown"
    assert _health(dispatch_enabled=broken)["state"] == "unknown"


def test_corrupt_tick_file_is_treated_as_missing(board_home):
    path = board_home / "kanban" / ".dispatcher-tick.json"
    path.parent.mkdir(parents=True)
    path.write_text("{not json", encoding="utf-8")

    assert read_tick() is None
    assert _health()["state"] == "unavailable"


def test_failed_dispatch_is_unknown_even_with_a_fresh_live_tick(board_home):
    record_tick(60, successful=True)
    success = read_tick()["last_success_at"]
    record_tick(60, successful=False)
    assert _health()["state"] == "unknown"
    assert "last dispatch pass" in _health()["message"]
    assert _health()["last_success_tick_at"] == success


def test_old_tick_without_completed_outcome_is_not_health_evidence(board_home):
    tick = {"pid": os.getpid(), "at": time.time(), "interval_seconds": 60}
    assert _health(read_tick=lambda: tick)["state"] == "unknown"


def test_future_tick_is_not_health_evidence(board_home):
    record_tick(60, successful=True)
    assert _health(now=time.time() - 300)["state"] == "unknown"


def test_health_uses_the_existing_cross_platform_process_probe(monkeypatch):
    from hermes_cli.kanban_runner_health import _pid_alive

    seen = []
    monkeypatch.setattr("gateway.status._pid_exists", lambda pid: seen.append(pid) or False)
    assert _pid_alive(4242) is False
    assert seen == [4242]
