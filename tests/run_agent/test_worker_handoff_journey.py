"""Real agent loop and SQLite retry handoff; only inference is scripted."""

import json
from copy import deepcopy
from contextlib import nullcontext
from types import SimpleNamespace
from unittest.mock import patch

import pytest

from hermes_cli import kanban_db as kb
from agent.delegation_context import delegated_child_context
from run_agent import AIAgent


@pytest.mark.parametrize("tool_count,delegated", [(1, False), (2, False), (1, True)])
def test_budget_warning_reaches_next_request_and_summary_reaches_retry(
    tmp_path, monkeypatch, tool_count, delegated
):
    monkeypatch.setenv("HERMES_HOME", str(tmp_path / "home"))
    monkeypatch.setenv("HERMES_KANBAN_HOME", str(tmp_path / "board"))
    monkeypatch.setattr("run_agent._hermes_home", tmp_path / "home")
    workspace = tmp_path / "project"
    workspace.mkdir()
    evidence = workspace / "evidence.txt"
    evidence.write_text("Recorded evidence\n", encoding="utf-8")
    second_evidence = workspace / "other-evidence.txt"
    second_evidence.write_text("Recorded evidence: second check\n", encoding="utf-8")
    monkeypatch.setenv("TERMINAL_CWD", str(workspace))
    with kb.connect_closing() as conn:
        task_id = kb.create_task(
            conn,
            title="bounded QA",
            assignee="default",
            max_retries=2,
            workspace_kind="dir",
            workspace_path=str(workspace),
        )
        run = kb.claim_task(conn, task_id)
    monkeypatch.setenv("HERMES_KANBAN_TASK", task_id)
    monkeypatch.setenv("HERMES_KANBAN_RUN_ID", str(run.current_run_id))
    schema = {
        "type": "function",
        "function": {
            "name": "read_file",
            "parameters": {
                "type": "object",
                "properties": {"path": {"type": "string"}},
                "required": ["path"],
            },
        },
    }
    with (
        patch("run_agent.get_tool_definitions", return_value=[schema]),
        patch("run_agent.OpenAI"),
    ):
        agent = AIAgent(
            model="test/model",
            provider="openai-compat",
            api_key="test-only",
            base_url="https://example.invalid/v1",
            max_iterations=3,
            quiet_mode=True,
            skip_memory=True,
            skip_context_files=True,
            session_id=f"handoff-{tool_count}",
        )
    agent._cached_system_prompt = "Stable instructions"
    agent._session_db = None
    agent._session_json_enabled = False
    agent.save_trajectories = False
    agent.compression_enabled = False
    requests = []

    def model_call(kwargs):
        requests.append(deepcopy(kwargs))
        calls = [
            SimpleNamespace(
                id=f"c{len(requests)}-{i}",
                type="function",
                function=SimpleNamespace(
                    name="read_file",
                    arguments=json.dumps({
                        "path": str(evidence if i == 0 else second_evidence)
                    }),
                ),
            )
            for i in range(tool_count)
        ]
        message = SimpleNamespace(content=None, reasoning=None, tool_calls=calls)
        return SimpleNamespace(
            choices=[SimpleNamespace(message=message, finish_reason="tool_calls")],
            usage=None,
        )

    agent._interruptible_api_call = model_call
    agent._handle_max_iterations = lambda *_: (
        "Next: verify browser. Evidence: evidence.txt"
    )
    with (
        patch("hermes_cli.plugins.invoke_hook", return_value=[]),
        delegated_child_context() if delegated else nullcontext(),
    ):
        result = agent.run_conversation("Read the saved evidence for this QA task.")
    assert not result["completed"]
    assert len(requests) == 3
    second_tools = [m for m in requests[1]["messages"] if m["role"] == "tool"]
    assert len(second_tools) == tool_count
    assert any("Recorded evidence" in str(m["content"]) for m in second_tools)
    assert sum("Worker budget:" in str(m["content"]) for m in second_tools) == (
        0 if delegated else 1
    )
    # The next iteration preserves the complete previously sent prefix.
    assert (
        requests[2]["messages"][: len(requests[1]["messages"])]
        == requests[1]["messages"]
    )
    with kb.connect_closing() as conn:
        if delegated:
            assert kb.get_task(conn, task_id).status == "running"
            assert kb.get_task(conn, task_id).consecutive_failures == 0
            return
        assert kb.get_task(conn, task_id).status == "ready"
        context = kb.build_worker_context(conn, task_id)
        assert "Next: verify browser" in context and "NOT completion" in context
        assert kb.get_task(conn, task_id).consecutive_failures == 1
