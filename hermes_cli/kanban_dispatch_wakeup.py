"""Best-effort cross-process wake signal; the dispatcher still owns all claims."""

from __future__ import annotations

import asyncio
import time
from pathlib import Path
from typing import Callable


def _marker(root: Path | None = None) -> Path:
    if root is None:
        from hermes_cli.kanban_db import kanban_home
        root = kanban_home()
    return root / "kanban" / ".dispatch-wakeup"


def wake_token(root: Path | None = None) -> tuple[int, int] | None:
    try:
        stat = _marker(root).stat()
        return stat.st_ino, stat.st_mtime_ns
    except OSError:
        return None


def request_dispatch(root: Path | None = None) -> bool:
    """Call only after the task transaction commits; failure must not undo it."""
    try:
        marker = _marker(root)
        marker.parent.mkdir(parents=True, exist_ok=True)
        marker.touch()
        return True
    except OSError:
        return False  # Regular polling is always the recovery path.


async def wait_for_dispatch_async(
    running: Callable[[], bool], interval: float, observed: tuple[int, int] | None,
) -> None:
    """Capture observed BEFORE the tick so requests during work are not lost."""
    deadline = time.monotonic() + interval
    while running() and wake_token() == observed:
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            return
        await asyncio.sleep(min(1.0, remaining))


def wait_for_dispatch(stop_event, interval: float, observed: tuple[int, int] | None) -> None:
    deadline = time.monotonic() + interval
    while not stop_event.is_set() and wake_token() == observed:
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            return
        stop_event.wait(timeout=min(1.0, remaining))
