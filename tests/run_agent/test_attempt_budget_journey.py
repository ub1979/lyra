"""A Kanban worker's call budget spans its goal-loop turns (real agent loop).

Each turn used to get a fresh ``IterationBudget(max_iterations)``, so a
goal-mode worker could spend a full budget on every continuation. With
``HERMES_KANBAN_ATTEMPT_MAX_CALLS`` a continuation turn gets only what remains.
Only inference is scripted; the agent loop and SQLite board are real.
"""

import json
from types import SimpleNamespace
from unittest.mock import patch

import pytest

from hermes_cli import kanban_db as kb
from run_agent import AIAgent


def _agent(tmp_path, monkeypatch, *, attempt_limit):
    monkeypatch.setenv("HERMES_HOME", str(tmp_path / "home"))
    monkeypatch.setenv("HERMES_KANBAN_HOME", str(tmp_path / "board"))
    monkeypatch.setattr("run_agent._hermes_home", tmp_path / "home")
    workspace = tmp_path / "project"
    workspace.mkdir()
    (workspace / "notes.txt").write_text("notes\n", encoding="utf-8")
    monkeypatch.setenv("TERMINAL_CWD", str(workspace))
    with kb.connect_closing() as conn:
        task_id = kb.create_task(
            conn, title="bounded build", assignee="default", max_retries=2,
            workspace_kind="dir", workspace_path=str(workspace),
        )
        run = kb.claim_task(conn, task_id)
    monkeypatch.setenv("HERMES_KANBAN_TASK", task_id)
    monkeypatch.setenv("HERMES_KANBAN_RUN_ID", str(run.current_run_id))
    if attempt_limit is None:
        monkeypatch.delenv("HERMES_KANBAN_ATTEMPT_MAX_CALLS", raising=False)
    else:
        monkeypatch.setenv("HERMES_KANBAN_ATTEMPT_MAX_CALLS", str(attempt_limit))
    schema = {"type": "function", "function": {
        "name": "read_file",
        "parameters": {"type": "object", "properties": {"path": {"type": "string"}},
                       "required": ["path"]},
    }}
    with patch("run_agent.get_tool_definitions", return_value=[schema]), patch("run_agent.OpenAI"):
        agent = AIAgent(
            model="test/model", provider="openai-compat", api_key="test-only",
            base_url="https://example.invalid/v1", max_iterations=5, quiet_mode=True,
            skip_memory=True, skip_context_files=True, session_id="attempt-budget",
        )
    agent._cached_system_prompt = "Stable instructions"
    agent._session_db = None
    agent._session_json_enabled = False
    agent.save_trajectories = False
    agent.compression_enabled = False
    agent._handle_max_iterations = lambda *_: "Handoff: next read notes again."
    return agent, workspace, task_id


def _script(agent, workspace, requests, *, first_turn_calls):
    """First turn: tool calls then a final answer. Later turns: tool calls only."""
    state = {"turn": 1, "in_turn": 0}

    def model_call(_kwargs):
        requests.append(state["turn"])
        state["in_turn"] += 1
        if state["turn"] == 1 and state["in_turn"] >= first_turn_calls:
            message = SimpleNamespace(content="First pass done.", reasoning=None, tool_calls=None)
            finish = "stop"
        else:
            message = SimpleNamespace(content=None, reasoning=None, tool_calls=[SimpleNamespace(
                id=f"c{len(requests)}", type="function",
                function=SimpleNamespace(
                    name="read_file", arguments=json.dumps({"path": str(workspace / "notes.txt")}),
                ),
            )])
            finish = "tool_calls"
        return SimpleNamespace(choices=[SimpleNamespace(message=message, finish_reason=finish)], usage=None)

    agent._interruptible_api_call = model_call
    return state


@pytest.mark.parametrize("attempt_limit", [6, None])
def test_continuation_turn_gets_only_the_remaining_attempt_budget(
    tmp_path, monkeypatch, attempt_limit
):
    agent, workspace, _task_id = _agent(tmp_path, monkeypatch, attempt_limit=attempt_limit)
    requests: list[int] = []
    state = _script(agent, workspace, requests, first_turn_calls=2)

    with patch("hermes_cli.plugins.invoke_hook", return_value=[]):
        agent.run_conversation("Build the first slice.")
        state.update(turn=2, in_turn=0)
        agent.run_conversation("The goal is not finished yet. Continue.")

    first_turn = requests.count(1)
    assert 0 < first_turn < 6
    if attempt_limit is None:
        # Classic behavior: every turn gets the full per-turn limit.
        assert requests.count(2) == agent.max_iterations
    else:
        assert requests.count(2) == attempt_limit - first_turn
        assert len(requests) == attempt_limit


def test_exhausting_the_attempt_budget_records_the_runtime_stop(tmp_path, monkeypatch):
    agent, workspace, task_id = _agent(tmp_path, monkeypatch, attempt_limit=6)
    requests: list[int] = []
    state = _script(agent, workspace, requests, first_turn_calls=2)

    with patch("hermes_cli.plugins.invoke_hook", return_value=[]):
        agent.run_conversation("Build the first slice.")
        state.update(turn=2, in_turn=0)
        agent.run_conversation("Continue.")

    assert len(requests) == 6
    with kb.connect_closing() as conn:
        task = kb.get_task(conn, task_id)
    assert "iteration budget exhausted" in (task.last_failure_error or "").casefold()
    assert task.consecutive_failures == 1
