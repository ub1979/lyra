"""Each coordinator guarantee is checked across every stage it crosses, not one.

The bugs users found in 0.19.38–0.19.42 all lived between two pieces that each
had a green unit test: a per-result cap undone by the aggregate stage, a hidden
tool whose handler still ran, a busy flag released on one path but not the
next. These tests follow each promise end to end.
"""

from __future__ import annotations

import importlib.util
import queue
import threading
from pathlib import Path
from types import SimpleNamespace

import pytest

ROOT = Path(__file__).resolve().parents[2]
STUDIO = ["ultimate-builder:app-it"]


def _load(name: str, relative: str):
    spec = importlib.util.spec_from_file_location(name, ROOT / relative)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)
    return module


def _register_project_run_tool():
    from tools.registry import registry

    tool = _load("invariants_project_run_tool", "plugins/ultimate-builder/project_run_tool.py")

    class Ctx:
        def register_tool(self, **kwargs):
            if "project_run" not in registry.get_tool_names_for_toolset("project-guide"):
                registry.register(**kwargs)

    tool.register_project_run_tool(Ctx())
    return tool


def test_coordinator_schema_has_dispatch_and_no_shell_and_workers_are_refused(
    tmp_path, monkeypatch
):
    """Schema → check_fn → handler → queue function: one gate, four stages."""
    from model_tools import get_tool_definitions
    from tui_gateway.studio_context import studio_toolsets

    tool = _register_project_run_tool()
    monkeypatch.delenv("HERMES_KANBAN_TASK", raising=False)
    names = {
        item["function"]["name"]
        for item in get_tool_definitions(studio_toolsets(STUDIO, ["coding", "project"]), quiet_mode=True)
    }
    assert "project_run" in names
    assert not {"terminal", "process", "read_terminal", "close_terminal"} & names
    assert tool.coordinator_only() is True

    # The same process as a worker: hidden, refused, and the queue itself refuses.
    monkeypatch.setenv("HERMES_KANBAN_HOME", str(tmp_path / "hermes"))
    monkeypatch.setenv("HERMES_KANBAN_TASK", "t_worker")
    project = tmp_path / "project"
    project.mkdir()
    assert tool.coordinator_only() is False
    refused = tool.project_run_tool({"action": "queue", "workspace": str(project), "phases": "sw-architect"})
    assert '"ok": false' in refused and "cannot queue" in refused
    runs = _load("invariants_project_runs", "plugins/ultimate-builder/project_runs.py")
    with pytest.raises(PermissionError):
        runs.queue_project_run(project, ["sw-architect"])
    assert runs.project_run_state(project)["tasks"] == []


def test_project_brain_survives_the_real_coordinator_budget_end_to_end():
    """_budget_for_agent → per-result stage → aggregate stage, for a marked coordinator."""
    from agent.tool_executor import _budget_for_agent
    from tools.tool_result_storage import enforce_turn_budget, maybe_persist_tool_result

    coordinator = SimpleNamespace(
        _studio_coordinator=True,
        context_compressor=SimpleNamespace(context_length=200_000),
    )
    budget = _budget_for_agent(coordinator)
    brain = "decision\n" * 1_800  # ~16 KB, a real Project Brain size
    turn = [
        {"role": "tool", "name": "read_file", "tool_call_id": "brain", "content": brain},
        *[
            {"role": "tool", "name": "web_extract", "tool_call_id": f"w{i}", "content": "y" * 6_000}
            for i in range(3)
        ],
    ]
    for message in turn:
        message["content"] = maybe_persist_tool_result(
            message["content"], message["name"], message["tool_call_id"], env=None, config=budget
        )
    enforce_turn_budget(turn, env=None, config=budget)

    assert turn[0]["content"] == brain
    # The aggregate stage trims uncapped siblings, largest first, only until the
    # turn fits; the coordinator's own document is never the one that gives.
    assert sum(len(m["content"]) for m in turn) <= budget.turn_budget
    assert any(len(m["content"]) < 6_000 for m in turn[1:])

    worker = SimpleNamespace(context_compressor=SimpleNamespace(context_length=200_000))
    huge = "x" * 90_000
    assert maybe_persist_tool_result(huge, "read_file", "w", env=None, config=_budget_for_agent(worker)) == huge


class _StopAfterPolls:
    def __init__(self, polls: int):
        self._remaining = polls + 1

    def is_set(self):
        self._remaining -= 1
        return self._remaining <= 0


def test_rejected_claim_then_completion_yields_idle_then_exactly_one_turn(monkeypatch):
    """The busy flag survives a rejected delivery and the next real update still gets its turn."""
    from tools import async_delegation as ad
    from tools.process_registry import process_registry
    from tui_gateway import server

    duplicate = {
        "type": "async_delegation",
        "delegation_id": "dup-inv",
        "origin_ui_session_id": "inv-sid",
        "session_key": "inv-key",
        "results": [{"status": "completed", "summary": "already delivered"}],
    }
    with ad._transaction() as conn:
        conn.execute(
            "INSERT INTO async_delegations "
            "(delegation_id,origin_session,state,dispatched_at,updated_at,delivery_state) "
            "VALUES (?,?,?,0,0,?)",
            ("dup-inv", "inv-key", "completed", "delivered"),
        )
    completed = {
        "type": "kanban_task",
        "task_id": "t_done",
        "task_title": "Research",
        "task_status": "done",
        "event_kind": "completed",
        "workspace_path": "/project",
        "session_key": "inv-key",
        "board": "default",
        "thread_id": "",
        "old_cursor": 1,
        "event_cursor": 2,
        "wait_reason": "",
        "attention_id": None,
        "attention_kind": None,
    }
    claims = iter([completed, None, None])
    monkeypatch.setattr(server, "_claim_kanban_tui_notification", lambda _s, _e: next(claims, None))
    monkeypatch.setattr(process_registry, "completion_queue", queue.Queue())
    process_registry.completion_queue.put(duplicate)
    emitted, prompts = [], []
    monkeypatch.setattr(server, "_emit", lambda *args, **_kw: emitted.append(args[0]))

    def _deliver(_rid, _sid, session, text, *_a, **_kw):
        prompts.append(text)
        session["running"] = False

    monkeypatch.setattr(server, "_run_prompt_submit", _deliver)
    session = {"session_key": "inv-key", "running": False, "history_lock": threading.RLock()}
    server._sessions["inv-sid"] = session
    try:
        server._notification_poller_loop(_StopAfterPolls(2), "inv-sid", session)
    finally:
        server._sessions.pop("inv-sid", None)

    assert len(prompts) == 1 and "IDRAK_INTERNAL_PROJECT_TASK_UPDATE" in prompts[0]
    assert emitted.count("message.start") == 1
    assert session["running"] is False


def test_two_worker_attempts_reach_the_run_state_as_one_summed_total(tmp_path, monkeypatch):
    """record → totals → project_run_state → the wire shape the browser normalises."""
    monkeypatch.setenv("HERMES_KANBAN_HOME", str(tmp_path / "hermes"))
    monkeypatch.delenv("HERMES_KANBAN_TASK", raising=False)
    from hermes_cli.kanban_usage import record_run_usage, usage_from_run_result

    runs = _load("invariants_project_runs_usage", "plugins/ultimate-builder/project_runs.py")
    project = tmp_path / "project"
    project.mkdir()
    task_id = runs.queue_project_run(project, ["sw-architect"])["tasks"][0]["task_id"]
    with runs.kb.connect_closing() as conn, runs.kb.write_txn(conn):
        record_run_usage(conn, task_id, usage_from_run_result({"input_tokens": 1000, "api_calls": 2, "session_id": "a1"}))
        record_run_usage(conn, task_id, usage_from_run_result({"input_tokens": 100, "api_calls": 1, "session_id": "a2"}))

    usage = runs.project_run_state(project)["tasks"][0]["usage"]

    assert usage["input_tokens"] == 1100
    assert usage["api_calls"] == 3
    assert usage["attempts"] == 2
    assert usage["cost_usd"] is None
    assert {"input_tokens", "output_tokens", "cache_read_tokens", "cache_write_tokens", "api_calls", "attempts", "recorded_at"} <= set(usage)
