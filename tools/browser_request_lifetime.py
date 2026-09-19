"""Retain browsers during bounded provider requests, not arbitrary heartbeats.

Python owns normal idle cleanup; the daemon retains a finite crash fallback.
No prompts, model tools, background keepalive requests or user state are added.
"""

from __future__ import annotations

from contextlib import contextmanager
import math
import os
import threading
import time

_lock = threading.Lock()
_requests: dict[str, dict[object, tuple]] = {}
_released: dict[str, float] = {}


def _positive(value, default=0.0):
    try:
        number = float(value)
        return number if math.isfinite(number) and number > 0 else default
    except (TypeError, ValueError):
        return default


def daemon_idle_timeout_ms(inactivity: float) -> str:
    """Finite crash fallback covering configured request bounds plus idle grace.

    Keep agent-browser's one-hour default as the floor. Normal 120s idle cleanup
    still happens in Python; the larger fallback matters after owner death.
    Include provider/model overrides, not just the default 1800s request bound.
    """
    bounds = [3600.0, _positive(os.getenv("HERMES_API_TIMEOUT"), 1800.0)]
    try:
        from hermes_cli.config import load_config_readonly
        providers = load_config_readonly().get("providers", {})
        for provider in providers.values():
            if not isinstance(provider, dict):
                continue
            bounds.append(_positive(provider.get("request_timeout_seconds")))
            models = provider.get("models", {})
            if isinstance(models, dict):
                bounds.extend(_positive(model.get("timeout_seconds"))
                              for model in models.values() if isinstance(model, dict))
    except (AttributeError, TypeError, OSError, ValueError):
        pass
    return str(math.ceil((max(bounds) + _positive(inactivity)) * 1000))


@contextmanager
def protect_browser_request(agent):
    """Retain this request's task browser until return, cancel or deadline."""
    task_id = getattr(agent, "_current_task_id", None)
    if not isinstance(task_id, str) or not task_id:
        yield
        return
    try:
        bound = _positive(agent._resolved_api_call_timeout(), 1800.0)
    except (AttributeError, TypeError, ValueError):
        bound = 1800.0
    token = object()
    now = time.monotonic()
    with _lock:
        # Release stamps only bridge return-to-next-browser-action; expire them
        # even in conversations that never use a browser.
        for key, stamp in list(_released.items()):
            if now - stamp > 3600:
                _released.pop(key, None)
        _released.pop(task_id, None)
        _requests.setdefault(task_id, {})[token] = (
            now + bound, agent, threading.current_thread(),
        )
    succeeded = False
    try:
        yield
        succeeded = True
    finally:
        with _lock:
            leases = _requests.get(task_id, {})
            leases.pop(token, None)
            if not leases:
                _requests.pop(task_id, None)
            if succeeded and not getattr(agent, "_interrupt_requested", False):
                _released[task_id] = time.monotonic()


def request_protects_browser(task_id: str, idle_seconds: float) -> bool:
    """Used by cleanup only; no model progress or usage claims are implied."""
    owner = task_id.removesuffix("::local")
    now = time.monotonic()
    with _lock:
        leases = _requests.get(owner, {})
        for token, (deadline, agent, thread) in list(leases.items()):
            if (now >= deadline or not thread.is_alive()
                    or getattr(agent, "_interrupt_requested", False)):
                leases.pop(token, None)
        if leases:
            return True
        stamp = _released.get(owner)
        if stamp is not None and now - stamp < idle_seconds:
            return True
        _released.pop(owner, None)
        _requests.pop(owner, None)
        return False
