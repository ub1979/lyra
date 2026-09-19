"""Own macOS idle-sleep protection for one active Studio model request.

Reuse the worker runner's caffeinate mechanism without wrapping an entire chat:
approval/user-input waits must not hold an assertion. Display sleep is allowed.
The process and timeout bounds remain effective even if Python cleanup fails.
"""

from __future__ import annotations

from contextlib import contextmanager
import logging
import math
import os
import subprocess
import sys

logger = logging.getLogger(__name__)


@contextmanager
def protect_studio_request(agent):
    """Best-effort OS assertion; failure never breaks a model request."""
    command = "/usr/bin/caffeinate"
    if (sys.platform != "darwin" or getattr(agent, "_studio_coordinator", False) is not True
            or not os.path.isfile(command)):
        yield
        return
    try:
        timeout = float(agent._resolved_api_call_timeout())
        if not math.isfinite(timeout) or timeout <= 0:
            timeout = 1800.0  # same finite fallback as the request layer
    except (AttributeError, TypeError, ValueError):
        timeout = 1800.0
    process = None
    try:
        process = subprocess.Popen(
            [command, "-i", "-w", str(os.getpid()), "-t", str(math.ceil(timeout))],
            stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL, close_fds=True,
        )
    except OSError:
        logger.warning("Could not protect active Studio request from idle sleep", exc_info=True)
    try:
        yield
    finally:
        if process is not None:
            try:
                if process.poll() is None:
                    process.terminate()
                process.wait(timeout=1)
            except subprocess.TimeoutExpired:
                try:
                    process.kill()
                    process.wait(timeout=1)
                except (OSError, subprocess.TimeoutExpired):
                    logger.warning("Idle-sleep helper cleanup failed; finite expiry remains")
            except OSError:
                logger.debug("Idle-sleep helper already exited", exc_info=True)
