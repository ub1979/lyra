from tui_gateway import server
from tui_gateway.server import _thinking_delta_payload


def test_provider_wait_notice_is_status_not_model_activity():
    payload = _thinking_delta_payload(
        "⏳ waiting on gpt-5.6-sol — 30s with no response yet"
    )

    assert payload == {
        "text": "⏳ waiting on gpt-5.6-sol — 30s with no response yet",
        "provider_wait": True,
    }


def test_real_thinking_remains_model_activity():
    assert _thinking_delta_payload("Considering the project structure") == {
        "text": "Considering the project structure",
        "provider_wait": False,
    }


def test_agent_callback_emits_the_provider_wait_marker(monkeypatch):
    emitted = []
    monkeypatch.setattr(
        server,
        "_emit",
        lambda event, sid, payload=None: emitted.append((event, sid, payload)),
    )

    server._agent_cbs("studio-session")["thinking_callback"](
        "⚠ no output from provider for 120s — reconnecting..."
    )

    assert emitted == [
        (
            "thinking.delta",
            "studio-session",
            {
                "text": "⚠ no output from provider for 120s — reconnecting...",
                "provider_wait": True,
            },
        )
    ]
