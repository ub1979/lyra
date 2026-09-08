"""Bounded replay of dashboard readiness and questions across reconnects."""

from collections import OrderedDict
import json


class DashboardPromptState:
    """Cache only readiness and the latest live question, never conversation text.

    Owned by one dashboard app and accessed under its existing event lock.
    Channel routing/authentication remains the responsibility of the transport.
    """

    def __init__(self, capacity: int = 128):
        self._capacity = capacity
        self._ready: OrderedDict[str, str] = OrderedDict()
        self._pending: OrderedDict[str, tuple[str, str]] = OrderedDict()

    def _remember_ready(self, channel: str, raw: str) -> None:
        self._ready[channel] = raw
        self._ready.move_to_end(channel)
        while len(self._ready) > self._capacity:
            self._ready.popitem(last=False)

    def observe(self, channel: str, raw: str) -> None:
        try:
            frame = json.loads(raw)
        except (TypeError, ValueError):
            return
        if not isinstance(frame, dict) or frame.get("method") != "event":
            return
        params = frame.get("params")
        if not isinstance(params, dict):
            return
        kind = params.get("type")
        payload = params.get("payload")
        payload = payload if isinstance(payload, dict) else {}
        request_id = payload.get("request_id")
        if kind == "session.info":
            self._remember_ready(channel, raw)
        elif kind == "clarify.request" and isinstance(request_id, str) and request_id:
            self._pending[channel] = (request_id, raw)
            self._pending.move_to_end(channel)
            while len(self._pending) > self._capacity:
                self._pending.popitem(last=False)
        elif kind in {"message.complete", "error", "session.closed"} or (
            kind == "tool.complete" and payload.get("name") == "clarify"
        ):
            self._pending.pop(channel, None)
        elif kind in {"clarify.expire", "clarify.resolved"}:
            pending = self._pending.get(channel)
            if pending and pending[0] == request_id:
                self._pending.pop(channel, None)
        if kind == "session.closed":
            self._ready.pop(channel, None)

    def replay(self, channel: str) -> str | None:
        pending = self._pending.get(channel)
        return pending[1] if pending else None

    def replay_frames(self, channel: str) -> tuple[str, ...]:
        """Return readiness first, then an unanswered question when present."""
        frames: list[str] = []
        ready = self._ready.get(channel)
        if ready:
            frames.append(ready)
        pending = self.replay(channel)
        if pending and pending not in frames:
            frames.append(pending)
        return tuple(frames)


def dashboard_prompt_state(app) -> DashboardPromptState:
    state = getattr(app.state, "dashboard_prompt_state", None)
    if state is None:
        state = DashboardPromptState()
        app.state.dashboard_prompt_state = state
    return state
