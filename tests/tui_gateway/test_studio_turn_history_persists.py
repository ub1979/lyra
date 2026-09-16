"""A Studio turn's reply is saved even when the turn itself changes the model.

Studio's coordinator adopts the configured model at the start of every turn
(``_sync_agent_model_with_config``). When that adoption switches models it
appends a ``[System: The active model … changed]`` note to the history and
bumps ``history_version`` — inside the very turn that already snapshotted the
version it will check before writing its reply. On every Studio open the hidden
welcome turn therefore ended with "history_version mismatch … agent output NOT
written to session history": the exchange was shown but never saved.

The second journey covers the other side: when the history really is changed
by something else during a turn, the gateway must still say so on the
``message.complete`` frame, and the frames are committed for the Studio
reducer to replay.
"""

from __future__ import annotations

import threading
from types import SimpleNamespace

from tests.tui_gateway.frame_fixtures import normalize_frames, write_or_check
from tests.tui_gateway.test_lyra_project_workflow import runtime  # noqa: F401 — fixture

MARKER_PREFIX = "[System: The active model for this chat has changed to"


def _studio_session(rt, *, agent_model: str) -> dict:
    session = {
        "session_key": "isolated-project-chat",
        "running": False,
        "history_lock": threading.Lock(),
        "history": [],
        "history_version": 0,
        "cwd": str(rt.project),
        # What marks a session as Studio's coordinator for the config sync.
        "create_skills": ["ultimate-builder:app-it"],
    }
    rt.server._sessions["studio"] = session
    rt.server._get_db().create_session(session["session_key"], source="tui", model=agent_model)
    return session


def _controlled_agent(session, db, replies, *, model: str, before_reply=None):
    transcript: list[dict] = []
    seen: list[str] = []

    def run_conversation(text, **kwargs):
        seen.append(text)
        reply = next(replies)
        if before_reply is not None:
            before_reply()
        messages = [
            {"role": "user", "content": text},
            {"role": "assistant", "content": reply},
        ]
        for message in messages:
            db.append_message(session_id=session["session_key"], **message)
        transcript.extend(messages)
        kwargs["stream_callback"](reply)
        # Like the real agent: the whole conversation it was given plus the
        # new exchange. The gateway replaces session history with this.
        return {"messages": list(session["history"]) + messages, "final_response": reply}

    agent = SimpleNamespace(
        session_id=session["session_key"],
        model=model,
        provider="mock",
        run_conversation=run_conversation,
    )
    return agent, seen


def _fake_switch(rt, agent):
    """Stand in for ``_apply_model_switch``: the real one talks to providers.

    Reproduces exactly the side effects the sync relies on — the live agent
    now reports the target model, and the real marker is appended to history.
    """
    calls: list[str] = []

    def apply(sid, session, raw, **kwargs):
        calls.append(raw)
        model = raw.split(" --provider ")[0]
        agent.model = model
        rt.server._append_model_switch_marker(session, model=model, provider="mock")
        return {"value": model, "warning": "", "confirm_required": False, "scope": "session"}

    return apply, calls


def _run_turn(rt, session, text):
    rt.server._run_prompt_submit(f"turn-{text[:8]}", "studio", session, text)
    session["_run_thread"].join(timeout=5)
    assert not session["_run_thread"].is_alive()
    assert not session["running"]


def _complete_frames(rt):
    frames = normalize_frames(rt.server._real_stdout.getvalue().splitlines())
    return frames, [f for f in frames if f["type"] == "message.complete"]


def test_first_turn_model_adoption_keeps_the_reply(runtime, monkeypatch, capsys):
    rt = runtime
    session = _studio_session(rt, agent_model="built-with-model")
    db = rt.server._get_db()
    agent, seen = _controlled_agent(
        session,
        db,
        iter(["Welcome — I looked at the folder; it is empty, so let's start with a plan.",
              "Second reply, same model, no new note."]),
        model="built-with-model",
    )
    session["agent"] = agent
    apply, switches = _fake_switch(rt, agent)
    monkeypatch.setattr(rt.server, "_apply_model_switch", apply)
    monkeypatch.setattr(rt.server, "_config_model_target", lambda: ("studio-model", "mock"))

    _run_turn(rt, session, "[[ IDRAK_INTERNAL_WELCOME ]] hello")

    assert switches == ["studio-model --provider mock"], "the sync must adopt the configured model once"
    roles = [(m["role"], m["content"]) for m in session["history"]]
    assert ("assistant", "Welcome — I looked at the folder; it is empty, so let's start with a plan.") in roles, (
        "the turn's reply must be written to session history"
    )
    assert any(c.startswith(MARKER_PREFIX) for _, c in roles), "the model note stays part of the history"
    assert session["history_version"] >= 2
    assert "history_version mismatch" not in capsys.readouterr().err
    _, completes = _complete_frames(rt)
    assert len(completes) == 1
    assert "warning" not in completes[0]["payload"]

    # A second turn on the now-adopted model must not switch or annotate again.
    _run_turn(rt, session, "and now a real question")
    assert switches == ["studio-model --provider mock"]
    assert sum(1 for _, c in [(m["role"], m["content"]) for m in session["history"]] if c.startswith(MARKER_PREFIX)) == 1
    assert [m["content"] for m in session["history"] if m["role"] == "assistant"] == [
        "Welcome — I looked at the folder; it is empty, so let's start with a plan.",
        "Second reply, same model, no new note.",
    ]
    assert len(seen) == 2


def test_external_history_change_during_turn_is_reported(runtime, monkeypatch, capsys):
    """Something else (undo, rollback, another client) rewrites history mid-turn:
    the reply must still be shown, and the frame must carry the warning."""
    rt = runtime
    session = _studio_session(rt, agent_model="studio-model")
    db = rt.server._get_db()

    def rewrite_history_externally():
        with session["history_lock"]:
            session["history"] = []
            session["history_version"] = int(session["history_version"]) + 1

    agent, _ = _controlled_agent(
        session,
        db,
        iter(["This reply arrives after someone rewrote the history."]),
        model="studio-model",
        before_reply=rewrite_history_externally,
    )
    session["agent"] = agent
    monkeypatch.setattr(rt.server, "_config_model_target", lambda: ("studio-model", "mock"))

    _run_turn(rt, session, "tell me something")

    assert "history_version mismatch" in capsys.readouterr().err
    frames, completes = _complete_frames(rt)
    assert len(completes) == 1
    payload = completes[0]["payload"]
    assert payload["text"] == "This reply arrives after someone rewrote the history."
    assert "not saved to session history" in payload["warning"]
    write_or_check("reply-not-saved", frames)
