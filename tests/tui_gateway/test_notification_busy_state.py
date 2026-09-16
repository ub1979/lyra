"""A rejected async-delegation delivery claim must leave the TUI session idle.

Ports ``output/lyra-notification-repro-2026-09-16.py``: an already-delivered
completion event is polled again, the durable SQLite claim rejects it, and
the session must not remain ``running`` with no prompt ever started.
"""

import queue
import threading

import pytest

from tools import async_delegation as ad
from tools.process_registry import process_registry
from tui_gateway import server


def _event(delegation_id="dup-1", session_key="busy-key"):
    return {
        "type": "async_delegation",
        "delegation_id": delegation_id,
        "origin_ui_session_id": "busy-sid",
        "session_key": session_key,
        "results": [{"status": "completed", "summary": "fixture complete"}],
    }


def _seed_delivered(delegation_id, session_key):
    with ad._transaction() as conn:
        conn.execute(
            "INSERT INTO async_delegations "
            "(delegation_id,origin_session,state,dispatched_at,updated_at,delivery_state) "
            "VALUES (?,?,?,0,0,?)",
            (delegation_id, session_key, "completed", "delivered"),
        )


def _session():
    return {
        "session_key": "busy-key",
        "running": False,
        "history_lock": threading.RLock(),
    }


@pytest.fixture
def poller_env(monkeypatch):
    emitted = []
    prompts = []
    monkeypatch.setattr(process_registry, "completion_queue", queue.Queue())
    monkeypatch.setattr(server, "_emit", lambda *args, **_kw: emitted.append(args[0]))

    def _deliver(_rid, _sid, session, *_args, **_kwargs):
        prompts.append(_args)
        session["running"] = False

    monkeypatch.setattr(server, "_run_prompt_submit", _deliver)
    session = _session()
    server._sessions["busy-sid"] = session
    yield {"session": session, "emitted": emitted, "prompts": prompts}
    server._sessions.pop("busy-sid", None)


def _stop_after_claim(monkeypatch, stop):
    actual = ad.claim_event_delivery

    def _claim_once(evt, consumer):
        stop.set()
        return actual(evt, consumer)

    monkeypatch.setattr(ad, "claim_event_delivery", _claim_once)


def test_live_loop_rejected_claim_leaves_session_idle(monkeypatch, poller_env):
    evt = _event()
    _seed_delivered(evt["delegation_id"], evt["session_key"])
    assert ad.claim_event_delivery(evt, "precheck") is None
    process_registry.completion_queue.put(evt)
    stop = threading.Event()
    _stop_after_claim(monkeypatch, stop)

    server._notification_poller_loop(stop, "busy-sid", poller_env["session"])

    assert poller_env["session"]["running"] is False
    assert poller_env["prompts"] == []
    assert "message.start" not in poller_env["emitted"]


def test_shutdown_drain_rejected_claim_leaves_session_idle(monkeypatch, poller_env):
    """The post-stop drain shares the bug shape and must share the repair."""
    evt = _event(delegation_id="dup-drain")
    _seed_delivered(evt["delegation_id"], evt["session_key"])
    stop = threading.Event()
    stop.set()
    process_registry.completion_queue.put(evt)

    server._notification_poller_loop(stop, "busy-sid", poller_env["session"])

    assert poller_env["session"]["running"] is False
    assert poller_env["prompts"] == []
    assert process_registry.completion_queue.empty()


def test_live_loop_accepted_claim_dispatches_once_and_completes(
    monkeypatch, poller_env
):
    evt = _event(delegation_id="fresh-1")
    with ad._transaction() as conn:
        conn.execute(
            "INSERT INTO async_delegations "
            "(delegation_id,origin_session,state,dispatched_at,updated_at,delivery_state) "
            "VALUES (?,?,?,0,0,?)",
            (evt["delegation_id"], evt["session_key"], "completed", "pending"),
        )
    process_registry.completion_queue.put(evt)
    stop = threading.Event()
    _stop_after_claim(monkeypatch, stop)

    server._notification_poller_loop(stop, "busy-sid", poller_env["session"])

    assert len(poller_env["prompts"]) == 1
    assert poller_env["emitted"].count("message.start") == 1
    assert poller_env["session"]["running"] is False
    with ad._transaction() as conn:
        row = conn.execute(
            "SELECT delivery_state FROM async_delegations WHERE delegation_id=?",
            (evt["delegation_id"],),
        ).fetchone()
    assert row[0] == "delivered"
