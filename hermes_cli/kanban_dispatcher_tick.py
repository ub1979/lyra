"""Record that the embedded Kanban dispatcher is actually checking for work.

Only the process that passed the dispatcher's singleton-lock gate runs the
dispatch loop. A completed pass proves work was checked, not that every ready
job can start (capacity and provider gates still apply). Health checks read this file instead of probing the lock:
briefly taking the lock from a checker would make a gateway that is starting
at that moment see it as contended and never dispatch.
"""

from __future__ import annotations

import json
import os
import time
from pathlib import Path
from typing import Any


def _tick_path(root: Path | None = None) -> Path:
    if root is None:
        from hermes_cli.kanban_db import kanban_home

        root = kanban_home()
    return Path(root) / "kanban" / ".dispatcher-tick.json"


def record_tick(interval_seconds: float, *, successful: bool, root: Path | None = None) -> None:
    """Record the outcome only after dispatch completes, never before it starts."""
    from utils import atomic_json_write

    previous = read_tick(root)
    now = time.time()
    last_success = previous.get("last_success_at") if previous and previous["pid"] == os.getpid() else None
    atomic_json_write(_tick_path(root), {
        "pid": os.getpid(),
        "at": now,
        "interval_seconds": float(interval_seconds),
        "successful": successful,
        "last_success_at": now if successful else last_success,
    })


def read_tick(root: Path | None = None) -> dict[str, Any] | None:
    """Return the last tick record, or None when missing or unreadable."""
    try:
        data = json.loads(_tick_path(root).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    if not isinstance(data, dict):
        return None
    try:
        return {
            "pid": int(data["pid"]),
            "at": float(data["at"]),
            "interval_seconds": float(data.get("interval_seconds") or 60.0),
            "successful": data.get("successful") is True,
            "last_success_at": float(data["last_success_at"]) if data.get("last_success_at") is not None else None,
        }
    except (KeyError, TypeError, ValueError):
        return None
