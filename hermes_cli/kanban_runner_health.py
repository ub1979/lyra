"""Report whether saved project jobs can actually start.

Three states, never optimistic:

- ``running``: a live process completed a successful dispatcher pass within two intervals
  plus a margin.
- ``unavailable``: dispatch is turned off, or no gateway and no fresh tick.
- ``unknown``: a gateway is alive but has not reported dispatching recently
  (still starting, an older build without tick records, or stuck), or the
  check itself failed.

``hermes_cli.kanban._check_dispatcher_presence`` deliberately returns healthy
when its probe fails. This module is the stricter check used before telling a
user that a job will start.
"""

from __future__ import annotations

import os
import time
from typing import Any, Callable

TICK_MARGIN_SECONDS = 30.0

MESSAGES = {
    "running": "The job runner is checking for work.",
    "disabled": (
        "Background jobs are turned off in settings "
        "(kanban.dispatch_in_gateway is false)."
    ),
    "unavailable": "The job runner is not running, so queued jobs cannot start yet.",
    "stale": (
        "The job runner is running but has not checked for work recently. "
        "Queued jobs may not start."
    ),
    "error": "Lyra could not check the job runner.",
    "dispatch_failed": "The job runner could not complete its last dispatch pass. Check the gateway logs.",
}


def _pid_alive(pid: int) -> bool:
    from gateway.status import _pid_exists

    try:
        # Reuse Hermes' cross-platform probe; a POSIX signal-zero probe is
        # not safe on Windows and must not be sent from a health check.
        return _pid_exists(int(pid))
    except (OSError, TypeError, ValueError):
        return False


def _dispatch_enabled() -> bool:
    if os.environ.get("HERMES_KANBAN_DISPATCH_IN_GATEWAY", "").strip().lower() in {
        "0", "false", "no", "off",
    }:
        return False
    from hermes_cli.config import load_config

    config = load_config()
    kanban = config.get("kanban", {}) if isinstance(config, dict) else {}
    return bool(kanban.get("dispatch_in_gateway", True))


def _gateway_pid() -> int | None:
    from gateway.status import get_running_pid

    return get_running_pid()


def _result(state: str, key: str, tick: dict[str, Any] | None) -> dict[str, Any]:
    return {
        "state": state,
        "message": MESSAGES[key],
        "last_tick_at": int(tick["at"]) if tick else None,
        "last_success_tick_at": tick.get("last_success_at") if tick else None,
    }


def job_runner_health(
    *,
    now: float | None = None,
    read_tick: Callable[[], dict[str, Any] | None] | None = None,
    pid_alive: Callable[[int], bool] = _pid_alive,
    gateway_pid: Callable[[], int | None] = _gateway_pid,
    dispatch_enabled: Callable[[], bool] = _dispatch_enabled,
) -> dict[str, Any]:
    """Return ``{"state", "message", "last_tick_at"}`` for the job runner."""
    tick = None
    try:
        if read_tick is None:
            from hermes_cli.kanban_dispatcher_tick import read_tick as _read

            read_tick = _read
        if not dispatch_enabled():
            return _result("unavailable", "disabled", None)
        tick = read_tick()
        current = time.time() if now is None else float(now)
        if tick and pid_alive(tick["pid"]):
            window = 2 * tick["interval_seconds"] + TICK_MARGIN_SECONDS
            if 0 <= current - tick["at"] <= window:
                if tick.get("successful") is not True:
                    return _result("unknown", "dispatch_failed", tick)
                return _result("running", "running", tick)
            return _result("unknown", "stale", tick)
        if gateway_pid():
            return _result("unknown", "stale", tick)
        return _result("unavailable", "unavailable", tick)
    except Exception:
        return _result("unknown", "error", tick)
