import json

from hermes_cli.dashboard_prompt_state import DashboardPromptState


def event(kind, **payload):
    return json.dumps({"method": "event", "params": {"type": kind, "payload": payload}})


def test_question_replays_only_to_its_channel_until_answer_or_expiry():
    state = DashboardPromptState()
    question = event(
        "clarify.request", request_id="r1", question="Country?", choices=["UK"]
    )
    state.observe("hello", question)
    assert state.replay("hello") == question
    assert state.replay("other-project") is None
    state.observe("hello", event("tool.complete", name="terminal"))
    state.observe("hello", event("clarify.expire", request_id="old-request"))
    assert state.replay("hello") == question
    state.observe("hello", event("clarify.expire", request_id="r1"))
    assert state.replay("hello") is None
    state.observe("hello", question)
    state.observe("hello", event("tool.complete", name="clarify"))
    assert state.replay("hello") is None


def test_new_question_replaces_old_and_terminal_events_clear_it():
    state = DashboardPromptState()
    old = event("clarify.request", request_id="r1", question="Old?")
    new = event("clarify.request", request_id="r2", question="New?")
    state.observe("hello", old)
    state.observe("hello", new)
    state.observe("hello", event("clarify.expire", request_id="r1"))
    assert state.replay("hello") == new
    for terminal in ("error", "message.complete", "session.closed"):
        state.observe("hello", new)
        state.observe("hello", event(terminal))
        assert state.replay("hello") is None


def test_bounded_cache_ignores_malformed_frames():
    state = DashboardPromptState(capacity=2)
    for channel in ("a", "b", "c"):
        state.observe(
            channel, event("clarify.request", request_id=channel, question="Question?")
        )
    assert state.replay("a") is None
    for raw in ("invalid", "[]", "null", '{"method":"event","params":null}'):
        state.observe("b", raw)
    assert state.replay("b") is not None


def test_real_broadcast_and_subscriber_route_replay_pending_question(monkeypatch):
    """Use the real handlers with an in-memory socket, without timing races."""
    import asyncio
    from types import SimpleNamespace
    from starlette.websockets import WebSocketDisconnect
    from hermes_cli import web_server

    monkeypatch.setattr(web_server, "_DASHBOARD_EMBEDDED_CHAT_ENABLED", True)
    monkeypatch.setattr(web_server, "_ws_auth_ok", lambda ws: True)
    monkeypatch.setattr(web_server, "_ws_request_is_allowed", lambda ws: True)
    app = SimpleNamespace(state=SimpleNamespace())

    class Socket:
        def __init__(self, channel):
            self.app = app
            self.query_params = {"channel": channel}
            self.sent = []

        async def accept(self):
            pass

        async def send_text(self, raw):
            self.sent.append(raw)

        async def receive_text(self):
            raise WebSocketDisconnect()

    async def scenario():
        frame = event(
            "clarify.request", request_id="r1", question="Country?", choices=["UK"]
        )
        await web_server._broadcast_event(app, "original", frame)
        web_server._get_event_channel_aliases(app)["refreshed"] = "original"
        refreshed = Socket("refreshed")
        await web_server.events_ws(refreshed)
        assert refreshed.sent == [frame]
        other = Socket("other")
        await web_server.events_ws(other)
        assert other.sent == []
        await web_server._broadcast_event(
            app, "original", event("tool.complete", name="clarify")
        )
        reopened = Socket("original")
        await web_server.events_ws(reopened)
        assert reopened.sent == []

    asyncio.run(scenario())
