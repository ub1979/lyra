"""Cross-component project lifecycle; controlled AI/socket boundaries, real I/O."""

from __future__ import annotations

import asyncio
import importlib.util
import io
import json
import os
from pathlib import Path
import queue
import subprocess
import sys
import threading
import time
from types import SimpleNamespace

import pytest


ROOT = Path(__file__).resolve().parents[2]


def until(predicate, timeout=10):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if predicate():
            return
        threading.Event().wait(0.01)
    pytest.fail("Workflow transition did not happen before the bounded deadline")


@pytest.fixture
def runtime(tmp_path, monkeypatch):
    home = tmp_path / "isolated-home"
    home.mkdir()
    monkeypatch.setenv("HERMES_HOME", str(home))
    monkeypatch.setenv("HERMES_KANBAN_HOME", str(home))
    monkeypatch.setenv("HERMES_SESSION_KEY", "isolated-project-chat")
    monkeypatch.setenv("PYTHONPATH", str(ROOT))
    # Never load developer credentials through the gateway's import-time dotenv.
    from hermes_cli import env_loader

    monkeypatch.setattr(env_loader, "load_hermes_dotenv", lambda **kwargs: None)
    stdout = sys.stdout
    from tui_gateway import server

    sys.stdout = stdout
    from hermes_cli import kanban_db as kb, web_server
    from hermes_state import SessionDB
    from tools.process_registry import process_registry

    db = SessionDB(db_path=home / "state.db")
    monkeypatch.setattr(server, "_db", db)
    monkeypatch.setattr(server, "_sessions", {})
    monkeypatch.setattr(server, "_pending", {})
    monkeypatch.setattr(server, "_answers", {})
    monkeypatch.setattr(server, "_real_stdout", io.StringIO())
    monkeypatch.setattr(process_registry, "completion_queue", queue.Queue())
    monkeypatch.setattr(web_server, "_DASHBOARD_EMBEDDED_CHAT_ENABLED", True)
    monkeypatch.setattr(web_server, "_ws_auth_ok", lambda ws: True)
    monkeypatch.setattr(web_server, "_ws_request_is_allowed", lambda ws: True)
    # Preserve the production spawner/env/lease path, substituting only the
    # AI executable with a bounded real subprocess which does deterministic work.
    monkeypatch.setattr(
        kb,
        "_resolve_hermes_argv",
        lambda: [
            sys.executable,
            str(ROOT / "tests/fixtures/lyra_workflow_worker.py"),
        ],
    )
    spec = importlib.util.spec_from_file_location(
        "workflow_project_runs", ROOT / "plugins/ultimate-builder/project_runs.py"
    )
    runs = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(runs)
    project = tmp_path / "project"
    project.mkdir()
    yield SimpleNamespace(
        server=server, kb=kb, web=web_server, runs=runs, project=project, tmp=tmp_path
    )
    db.close()


def approve_after_reconnect(rt):
    """Feed actual gateway frames into the broadcaster and reconnect route."""
    result = []
    thread = threading.Thread(
        target=lambda: result.append(
            rt.server._block(
                "clarify.request",
                "original",
                {"question": "Start research?"},
                timeout=5,
            )
        )
    )
    thread.start()
    try:
        until(lambda: "clarify.request" in rt.server._real_stdout.getvalue())
        frame = rt.server._real_stdout.getvalue().splitlines()[0]
        request_id = json.loads(frame)["params"]["payload"]["request_id"]
        app = SimpleNamespace(state=SimpleNamespace())

        class Socket:
            def __init__(self, channel):
                self.app = app
                self.query_params = {"channel": channel}
                self.sent = []

            async def accept(self):
                pass

            async def send_text(self, value):
                self.sent.append(value)

            async def receive_text(self):
                from starlette.websockets import WebSocketDisconnect

                raise WebSocketDisconnect()

        async def reconnect():
            await rt.web._broadcast_event(app, "original", frame)
            rt.web._get_event_channel_aliases(app)["reconnected"] = "original"
            socket = Socket("reconnected")
            await rt.web.events_ws(socket)
            assert socket.sent == [frame]
            other = Socket("other-project")
            await rt.web.events_ws(other)
            assert other.sent == []

        asyncio.run(reconnect())
        response = rt.server.handle_request({
            "id": "answer",
            "method": "clarify.respond",
            "params": {"request_id": request_id, "answer": "Yes"},
        })
        assert response["result"]["status"] == "ok"
        thread.join(timeout=5)
        assert not thread.is_alive()
        assert result == ["Yes"]
        resolved = rt.server._real_stdout.getvalue().splitlines()[-1]
        assert json.loads(resolved)["params"]["type"] == "clarify.resolved"

        async def resolved_reconnect():
            await rt.web._broadcast_event(app, "original", resolved)
            socket = Socket("original")
            await rt.web.events_ws(socket)
            assert socket.sent == []

        asyncio.run(resolved_reconnect())
    finally:
        thread.join(timeout=6)


@pytest.mark.parametrize("fail_first_delivery", [False, True])
@pytest.mark.parametrize("creation", ["phase", "raw-review"])
def test_approval_to_worker_to_resumed_chat(
    runtime, monkeypatch, fail_first_delivery, creation
):
    rt = runtime
    approve_after_reconnect(rt)
    if creation == "raw-review":
        # Real CLI parser/handler in a fresh process, as a terminal tool calls
        # it. The test never manually adds a notification subscription.
        script = (
            "import argparse; from hermes_cli.kanban import build_parser, kanban_command; "
            "p=argparse.ArgumentParser(); build_parser(p.add_subparsers()); "
            "raise SystemExit(kanban_command(p.parse_args()))"
        )
        command = [
            sys.executable,
            "-c",
            script,
            "kanban",
            "create",
            "Initial project setup",
            "--assignee",
            "default",
            "--workspace",
            f"dir:{rt.project}",
            "--idempotency-key",
            "raw-review-regression",
            "--json",
        ]
        queued = json.loads(
            subprocess.run(
                command, check=True, capture_output=True, text=True, timeout=15
            ).stdout
        )
        repeated = json.loads(
            subprocess.run(
                command, check=True, capture_output=True, text=True, timeout=15
            ).stdout
        )
        assert queued["subscribed"] and repeated["subscribed"]
        task_id = queued["id"]
        assert repeated["id"] == task_id
        monkeypatch.setattr(
            rt.kb,
            "_resolve_hermes_argv",
            lambda: [
                sys.executable,
                str(ROOT / "tests/fixtures/lyra_workflow_worker.py"),
                "--review",
            ],
        )
    else:
        queued = rt.runs.queue_project_run(rt.project, ["researcher"])
        task_id = queued["tasks"][0]["task_id"]
        retry = rt.runs.queue_project_run(rt.project, ["researcher"])
        assert retry["tasks"][0]["task_id"] == task_id
        assert retry["tasks"][0]["reused"]
    assert rt.runs.project_run_state(rt.project)["state"] == "queued"

    with rt.kb.connect_closing() as conn:
        dispatched = rt.kb.dispatch_once(conn, max_spawn=1)
        assert [item[0] for item in dispatched.spawned] == [task_id]
        pid = rt.kb.get_task(conn, task_id).worker_pid
    try:
        until(lambda: (rt.project / "worker-started").exists())
        assert rt.runs.project_run_state(rt.project)["state"] == "working"
        with rt.kb.connect_closing() as conn:
            assert rt.kb.get_task(conn, task_id).last_heartbeat_at
            assert not rt.kb.dispatch_once(conn, max_spawn=1).spawned
        # No browser/session exists when the worker finishes.
        (rt.project / "allow-completion").touch()
        expected_status = "blocked" if creation == "raw-review" else "done"
        until(
            lambda: (
                rt.runs.project_run_state(rt.project)["tasks"][0]["status"]
                == expected_status
            )
        )
        if creation == "raw-review":
            state = rt.runs.project_run_state(rt.project)
            assert state["state"] == "needs_attention"
            assert state["tasks"][0]["attention_kind"] == "review"
            assert state["tasks"][0]["attention_id"]
        evidence = subprocess.run(
            ["git", "show", "HEAD:research-report.md"],
            cwd=rt.project,
            capture_output=True,
            text=True,
            check=True,
            timeout=10,
        )
        assert "isolated worker completed" in evidence.stdout
    finally:
        (rt.project / "allow-completion").touch()
        if pid:
            # This is our exact test child, never a discovered live gateway PID.
            until(lambda: os.waitpid(pid, os.WNOHANG)[0] == pid, timeout=25)

    other = {"session_key": "other-project", "running": False}
    assert rt.server._claim_kanban_tui_notification("other", other) is None
    session = {
        "session_key": "isolated-project-chat",
        "running": False,
        "history_lock": threading.Lock(),
        "history": [],
        "cwd": str(rt.project),
        "model_override": "controlled-test",
    }
    rt.server._sessions["resumed"] = session
    delivered = []
    attempts = []
    final_text = (
        "Research is ready. The application is not finished; architecture is next."
    )
    db = rt.server._get_db()
    db.create_session(session["session_key"], source="tui", model="controlled-test")
    db.set_session_title(session["session_key"], "Isolated workflow verification")

    def controlled_model(text, **kwargs):
        assert (rt.project / "research-report.md").exists()
        delivered.append(text)
        messages = [
            {"role": "user", "content": text},
            {"role": "assistant", "content": final_text},
        ]
        for message in messages:
            db.append_message(session_id=session["session_key"], **message)
        kwargs["stream_callback"](final_text)
        return {"messages": messages, "final_response": final_text}

    session["agent"] = SimpleNamespace(
        session_id=session["session_key"],
        model="controlled-test",
        run_conversation=controlled_model,
    )
    submit = rt.server._run_prompt_submit

    def controlled_coordinator(rid, sid, resumed, text):
        attempts.append(text)
        if fail_first_delivery and len(attempts) == 1:
            stop.set()
            raise ConnectionError("Controlled interruption before coordinator delivery")
        # Keep the real turn thread, streaming, history update and terminal
        # event path. Only model inference above is deterministic.
        submit(rid, sid, resumed, text)
        resumed["_run_thread"].join(timeout=5)
        assert not resumed["_run_thread"].is_alive()
        stop.set()

    monkeypatch.setattr(rt.server, "_run_prompt_submit", controlled_coordinator)
    for _ in range(2 if fail_first_delivery else 1):
        stop = threading.Event()
        session.pop("_kanban_notification_next_poll", None)
        poller = threading.Thread(
            target=rt.server._notification_poller_loop, args=(stop, "resumed", session)
        )
        poller.start()
        try:
            assert stop.wait(5), (
                "Saved completion never reached the resumed coordinator"
            )
        finally:
            stop.set()
            poller.join(timeout=6)
        assert not poller.is_alive()
    assert len(delivered) == 1
    data = json.loads(delivered[0].split("\nJob data: ", 1)[1])
    assert data["task_status"] == expected_status
    assert data["task_id"] == task_id
    if creation == "raw-review":
        assert data["attention_kind"] == "review"
        assert data["wait_reason"].startswith("review-required:")
    assert str(rt.project) in delivered[0]
    session.pop("_kanban_notification_next_poll", None)
    assert rt.server._claim_kanban_tui_notification("resumed", session) is None
    frames = [
        json.loads(line) for line in rt.server._real_stdout.getvalue().splitlines()
    ]
    notice = (
        "paused for review"
        if creation == "raw-review"
        else "finished. Lyra is checking"
    )
    assert any(notice in str(frame) for frame in frames)
    completed = [
        frame["params"]["payload"]
        for frame in frames
        if frame.get("params", {}).get("type") == "message.complete"
    ]
    assert len(completed) == 1
    assert completed[0]["status"] == "complete"
    assert completed[0]["text"] == final_text
    assert session["history"][-1]["content"] == final_text
    assert db.get_messages(session["session_key"])[-1]["content"] == final_text
    assert not session["running"]


class _StopAfterOneClaim:
    """Let the poller run one queue timeout plus one Kanban claim, then exit."""

    def __init__(self):
        self._checks = 0

    def is_set(self):
        self._checks += 1
        return self._checks > 1


def _finish_one_research_job(rt):
    queued = rt.runs.queue_project_run(rt.project, ["researcher"])
    task_id = queued["tasks"][0]["task_id"]
    with rt.kb.connect_closing() as conn:
        dispatched = rt.kb.dispatch_once(conn, max_spawn=1)
        assert [item[0] for item in dispatched.spawned] == [task_id]
        pid = rt.kb.get_task(conn, task_id).worker_pid
    try:
        until(lambda: (rt.project / "worker-started").exists())
        (rt.project / "allow-completion").touch()
        until(
            lambda: rt.runs.project_run_state(rt.project)["tasks"][0]["status"] == "done"
        )
    finally:
        (rt.project / "allow-completion").touch()
        if pid:
            until(lambda: os.waitpid(pid, os.WNOHANG)[0] == pid, timeout=25)
    return task_id


def test_notification_turn_after_reply_keeps_both_replies(runtime, monkeypatch):
    """Two turns with no user message between them must produce two replies, not one.

    This is the journey the browser lost in 0.19.41: Lyra answered the user, a
    saved job's completion started its own turn, and its reply replaced the
    first on screen. The frames captured here are committed under
    tests/fixtures/studio_frames/ and replayed through the Studio event reducer.
    """
    from tests.tui_gateway.frame_fixtures import normalize_frames, write_or_check

    rt = runtime
    task_id = _finish_one_research_job(rt)

    session = {
        "session_key": "isolated-project-chat",
        "running": False,
        "history_lock": threading.Lock(),
        "history": [],
        "cwd": str(rt.project),
        "model_override": "controlled-test",
    }
    rt.server._sessions["resumed"] = session
    db = rt.server._get_db()
    db.create_session(session["session_key"], source="tui", model="controlled-test")
    replies = iter([
        "Here is where the project stands: research is finished, architecture is next.",
        "That was the completion notice for Research; nothing new is needed from you.",
    ])
    seen = []
    transcript = []

    def controlled_model(text, **kwargs):
        # Like the real agent, return the whole conversation: the gateway
        # replaces session history with it rather than appending.
        seen.append(text)
        reply = next(replies)
        messages = [
            {"role": "user", "content": text},
            {"role": "assistant", "content": reply},
        ]
        for message in messages:
            db.append_message(session_id=session["session_key"], **message)
        transcript.extend(messages)
        kwargs["stream_callback"](reply)
        return {"messages": list(transcript), "final_response": reply}

    session["agent"] = SimpleNamespace(
        session_id=session["session_key"],
        model="controlled-test",
        run_conversation=controlled_model,
    )

    # Turn 1: the user's own message through the real turn path.
    rt.server._run_prompt_submit("user-turn", "resumed", session, "hi, what's the progress?")
    session["_run_thread"].join(timeout=5)
    assert not session["_run_thread"].is_alive()
    assert not session["running"]

    # Turn 2: the saved completion, delivered by the real poller into a real turn.
    submit = rt.server._run_prompt_submit
    stop = threading.Event()

    def coordinator(rid, sid, resumed, text, *args, **kwargs):
        submit(rid, sid, resumed, text, *args, **kwargs)
        resumed["_run_thread"].join(timeout=5)
        stop.set()

    monkeypatch.setattr(rt.server, "_run_prompt_submit", coordinator)
    session.pop("_kanban_notification_next_poll", None)
    poller = threading.Thread(
        target=rt.server._notification_poller_loop, args=(stop, "resumed", session)
    )
    poller.start()
    try:
        assert stop.wait(10), "Saved completion never reached the coordinator"
    finally:
        stop.set()
        poller.join(timeout=6)
    assert len(seen) == 2
    assert "IDRAK_INTERNAL_PROJECT_TASK_UPDATE" in seen[1]
    assert [m["content"] for m in session["history"] if m["role"] == "assistant"][-2:] == [
        "Here is where the project stands: research is finished, architecture is next.",
        "That was the completion notice for Research; nothing new is needed from you.",
    ]
    turn_frames = normalize_frames(rt.server._real_stdout.getvalue().splitlines())
    completes = [i for i, f in enumerate(turn_frames) if f["type"] == "message.complete"]
    assert len(completes) == 2
    starts = [i for i, f in enumerate(turn_frames) if f["type"] == "message.start"]
    assert any(i < completes[0] for i in starts)
    assert any(completes[0] < i < completes[1] for i in starts), (
        "the notification turn must announce itself with message.start"
    )
    write_or_check("notification-after-reply", turn_frames)

    # Turn-free: a re-queued failure on the same task is one quiet line, no turn.
    marker = len(rt.server._real_stdout.getvalue().splitlines())
    with rt.kb.connect_closing() as conn, rt.kb.write_txn(conn):
        rt.kb._append_event(conn, task_id, "timed_out", {"reason": "controlled retry"})

    def never(rid, sid, resumed, text, *args, **kwargs):
        pytest.fail("a timed_out update must not start a model turn")

    monkeypatch.setattr(rt.server, "_run_prompt_submit", never)
    session.pop("_kanban_notification_next_poll", None)
    rt.server._notification_poller_loop(_StopAfterOneClaim(), "resumed", session)
    notice_frames = normalize_frames(rt.server._real_stdout.getvalue().splitlines()[marker:])
    kinds = [(f["type"], (f.get("payload") or {}).get("kind")) for f in notice_frames]
    assert ("status.update", "project_job") in kinds
    assert not any(t == "message.start" for t, _ in kinds)
    assert not session["running"]
    write_or_check("timed-out-notice", notice_frames)
