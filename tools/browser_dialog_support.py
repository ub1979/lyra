"""Keep pending browser dialogs observable without blocking the command queue.

Reuse the existing CDP supervisor on the *same* locally owned browser. Its
independent connection can answer a dialog while agent-browser is awaiting a
click or snapshot. Sending another CLI command into that queue cannot do so.
"""
from __future__ import annotations

import subprocess
import time
import logging
from urllib.parse import urlparse


class PendingBrowserDialog(Exception):
    def __init__(self, response: dict):
        self.response = response
        super().__init__(response["error"])


def pending_dialog_response(task_id: str) -> dict | None:
    from tools.browser_supervisor import SUPERVISOR_REGISTRY

    supervisor = SUPERVISOR_REGISTRY.get(task_id)
    if supervisor is None:
        return None
    snapshot = supervisor.snapshot()
    if not snapshot.pending_dialogs:
        return None
    return {
        "success": False,
        "error": (
            "The page is waiting for a dialog response. The previous action may "
            "already have run; respond to the dialog, then inspect the page "
            "before repeating that action."
        ),
        "pending_dialogs": snapshot.to_dict()["pending_dialogs"],
    }


def wait_for_command(proc, timeout: float, task_id: str) -> None:
    """Yield control to the model on a dialog, without killing its browser.

    Only the short-lived CLI client is stopped by the caller. The daemon's
    original action resumes after the independent supervisor answers the dialog.
    Ordinary command deadlines keep their existing meaning.
    """
    from tools.browser_supervisor import SUPERVISOR_REGISTRY

    if SUPERVISOR_REGISTRY.get(task_id) is None:
        proc.wait(timeout=timeout)
        return
    deadline = time.monotonic() + timeout
    while True:
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise subprocess.TimeoutExpired(proc.args, timeout)
        try:
            proc.wait(timeout=min(.1, remaining))
            return
        except subprocess.TimeoutExpired:
            pending = pending_dialog_response(task_id)
            if pending:
                raise PendingBrowserDialog(pending)


def attach_local_supervisor(task_id: str, page_url: str) -> None:
    """Discover only this task's loopback endpoint; never change CLI transport."""
    from tools import browser_tool as bt

    with bt._cleanup_lock:
        session = bt._active_sessions.get(task_id)
        if not session or session.get("cdp_url") or session.get("dialog_probe_done"):
            return
        if bt._using_lightpanda_engine():
            return
        session["dialog_probe_done"] = True
    try:
        result = bt._run_browser_command(task_id, "get", ["cdp-url"], timeout=5)
        data = result.get("data")
        endpoint = data.get("cdpUrl", "") if isinstance(data, dict) else ""
        parsed = urlparse(endpoint) if isinstance(endpoint, str) else None
        if parsed and parsed.scheme == "ws" and parsed.hostname in {"localhost", "127.0.0.1", "::1"}:
            # Never replace the CLI's isolated --session with a --cdp daemon.
            bt._ensure_cdp_supervisor(task_id, local_cdp_url=endpoint, target_url=page_url)
    except Exception:
        logging.getLogger(__name__).debug("Local dialog supervision unavailable", exc_info=True)
