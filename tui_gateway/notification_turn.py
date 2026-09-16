"""Own the session busy flag for one durable notification delivery attempt.

The TUI gateway marks a session ``running`` before it claims an async
delegation's completion event, then starts a prompt whose ``finally`` clears
the flag. When the claim is rejected (the event was already delivered, or
another consumer holds it) no prompt starts, so nothing clears the flag and
the conversation stays "busy" forever without a single model call. The
busy flag and the claim must therefore be one step whose failure paths
release what they acquired.
"""

from __future__ import annotations

import sys
from typing import Callable, Optional

__all__ = ["begin_notification_turn"]

BUSY = "busy"
REJECTED = "rejected"
FAILED = "failed"
CLAIMED = "claimed"


def begin_notification_turn(
    session: dict,
    evt: dict,
    consumer: str,
    *,
    claim_fn: Optional[Callable[[dict, str], Optional[str]]] = None,
) -> tuple[str, Optional[str]]:
    """Mark the session busy and claim delivery; release busy if no prompt can start.

    Returns ``(outcome, claim_id)``. ``"busy"`` means the session was already
    running and the caller decides how to requeue. ``"rejected"`` and
    ``"failed"`` mean the claim returned ``None`` or raised; the busy flag has
    already been released so the session is idle again. ``"claimed"`` carries
    the claim token (possibly ``""`` for event types that need no durable
    claim — that empty string is valid and must not be treated as rejection).
    """
    with session["history_lock"]:
        if session.get("running"):
            return BUSY, None
        session["running"] = True

    if claim_fn is None:
        from tools.async_delegation import claim_event_delivery as claim_fn

    try:
        claim = claim_fn(evt, consumer)
    except Exception as exc:
        _release_busy(session)
        print(
            f"[tui_gateway] notification delivery claim failed: "
            f"{type(exc).__name__}: {exc}",
            file=sys.stderr,
        )
        return FAILED, None
    if claim is None:
        _release_busy(session)
        return REJECTED, None
    return CLAIMED, claim


def _release_busy(session: dict) -> None:
    with session["history_lock"]:
        session["running"] = False
