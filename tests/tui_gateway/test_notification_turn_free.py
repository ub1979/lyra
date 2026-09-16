"""A re-queued failure reaches the chat as one line; a live decision still gets a turn."""

import queue
import threading

import pytest

from tools.process_registry import process_registry
from tui_gateway import server


class _StopAfterOnePoll:
    def __init__(self):
        self._checks = 0

    def is_set(self):
        self._checks += 1
        return self._checks > 1


def _kanban_event(**fields):
    return {
        "type": "kanban_task",
        "task_id": "t_arch",
        "task_title": "Architecture",
        "workspace_path": "/project",
        "session_key": "turn-free-key",
        "board": "default",
        "thread_id": "",
        "old_cursor": 3,
        "event_cursor": 4,
        "wait_reason": "",
        "attention_id": None,
        "attention_kind": None,
        **fields,
    }


@pytest.fixture
def poller(monkeypatch):
    emitted = []
    prompts = []
    monkeypatch.setattr(process_registry, "completion_queue", queue.Queue())
    monkeypatch.setattr(server, "_emit", lambda *args, **_kw: emitted.append(args))

    def _deliver(_rid, _sid, session, text, *_a, **_kw):
        prompts.append(text)
        session["running"] = False

    monkeypatch.setattr(server, "_run_prompt_submit", _deliver)
    session = {"session_key": "turn-free-key", "running": False, "history_lock": threading.RLock()}
    server._sessions["turn-free-sid"] = session

    def run(evt):
        claims = iter([evt, None])
        monkeypatch.setattr(
            server, "_claim_kanban_tui_notification", lambda _sid, _session: next(claims, None)
        )
        server._notification_poller_loop(_StopAfterOnePoll(), "turn-free-sid", session)
        return session

    yield run, emitted, prompts
    server._sessions.pop("turn-free-sid", None)


def test_requeued_failure_is_one_notice_and_no_turn(poller):
    run, emitted, prompts = poller

    session = run(_kanban_event(event_kind="timed_out", task_status="ready"))

    assert prompts == []
    assert session["running"] is False
    kinds = [args[2].get("kind") for args in emitted if args[0] == "status.update"]
    assert "project_job" in kinds
    notice = next(args[2] for args in emitted if args[2].get("kind") == "project_job")
    assert "attempt failed" in notice["text"]
    assert notice["task_id"] == "t_arch" and notice["event_kind"] == "timed_out"
    assert not any(args[0] == "message.start" for args in emitted)


def test_stale_block_whose_task_moved_on_is_turn_free(poller):
    run, emitted, prompts = poller
    run(_kanban_event(event_kind="blocked", task_status="running"))
    assert prompts == []
    assert any(args[2].get("kind") == "project_job" for args in emitted if args[0] == "status.update")


def test_live_block_and_completion_still_start_a_turn(poller):
    run, emitted, prompts = poller

    run(_kanban_event(event_kind="blocked", task_status="blocked", attention_kind="input"))
    run(_kanban_event(event_kind="completed", task_status="done"))

    assert len(prompts) == 2
    assert "IDRAK_INTERNAL_PROJECT_TASK_UPDATE" in prompts[0]
    assert not any(args[2].get("kind") == "project_job" for args in emitted if args[0] == "status.update")
