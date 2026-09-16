"""A notification claim that starts no prompt must leave the session idle."""

import threading

import pytest

from tui_gateway.notification_turn import begin_notification_turn

EVENT = {"type": "async_delegation", "delegation_id": "d-1"}


def _session(running=False):
    return {"running": running, "history_lock": threading.RLock()}


def test_busy_session_is_reported_and_left_untouched():
    session = _session(running=True)
    calls = []

    outcome, claim = begin_notification_turn(
        session, EVENT, "tui-poller", claim_fn=lambda *a: calls.append(a) or "x"
    )

    assert (outcome, claim) == ("busy", None)
    assert session["running"] is True
    assert calls == []


def test_rejected_claim_releases_busy_flag():
    session = _session()

    outcome, claim = begin_notification_turn(
        session, EVENT, "tui-poller", claim_fn=lambda _e, _c: None
    )

    assert (outcome, claim) == ("rejected", None)
    assert session["running"] is False


def test_claim_exception_releases_busy_flag_and_reports(capsys):
    session = _session()

    def _boom(_evt, _consumer):
        raise RuntimeError("database locked")

    outcome, claim = begin_notification_turn(
        session, EVENT, "tui-poller", claim_fn=_boom
    )

    assert (outcome, claim) == ("failed", None)
    assert session["running"] is False
    assert "database locked" in capsys.readouterr().err


@pytest.mark.parametrize("token", ["tui-poller:1:abc", ""])
def test_accepted_claim_keeps_session_busy_and_returns_token(token):
    """``""`` is the valid no-claim token for non-delegation events, not a rejection."""
    session = _session()
    seen = []

    def _claim(evt, consumer):
        seen.append((evt, consumer))
        return token

    outcome, claim = begin_notification_turn(
        session, EVENT, "tui-post-turn", claim_fn=_claim
    )

    assert (outcome, claim) == ("claimed", token)
    assert session["running"] is True
    assert seen == [(EVENT, "tui-post-turn")]
