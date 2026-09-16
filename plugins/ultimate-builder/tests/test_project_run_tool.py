"""The coordinator dispatches through one bounded tool that workers never see."""

from __future__ import annotations

import importlib.util
import json
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]


def load_tool():
    spec = importlib.util.spec_from_file_location(
        "ultimate_builder_project_run_tool_test", ROOT / "project_run_tool.py"
    )
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)
    return module


def load_plugin():
    spec = importlib.util.spec_from_file_location("ultimate_builder_tool_reg", ROOT / "__init__.py")
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)
    return module


@pytest.fixture
def project(tmp_path, monkeypatch):
    monkeypatch.setenv("HERMES_KANBAN_HOME", str(tmp_path / "hermes"))
    monkeypatch.delenv("HERMES_KANBAN_TASK", raising=False)
    workspace = tmp_path / "project"
    workspace.mkdir()
    return workspace


def test_queue_status_and_control_round_trip(project):
    tool = load_tool()

    queued = json.loads(
        tool.project_run_tool(
            {"action": "queue", "workspace": str(project), "phases": "sw-architect"}
        )
    )
    assert queued["tasks"][0]["task_id"]

    summary = json.loads(tool.project_run_tool({"action": "status", "workspace": str(project)}))
    assert summary["state"] in {"queued", "working", "needs_attention", "idle"}
    assert "task_count" in summary

    full = json.loads(
        tool.project_run_tool({"action": "status", "workspace": str(project), "summary": False})
    )
    assert full["tasks"][0]["task_id"] == queued["tasks"][0]["task_id"]

    paused = json.loads(tool.project_run_tool({"action": "pause", "workspace": str(project)}))
    assert paused["action"] == "pause"
    resumed = json.loads(tool.project_run_tool({"action": "resume", "workspace": str(project)}))
    assert resumed["action"] == "resume"


def test_rejects_bad_action_relative_workspace_and_missing_phases(project):
    tool = load_tool()
    assert "Unknown action" in json.loads(
        tool.project_run_tool({"action": "deploy", "workspace": str(project)})
    )["error"]
    assert "absolute" in json.loads(
        tool.project_run_tool({"action": "status", "workspace": "relative/path"})
    )["error"]
    assert "phases is required" in json.loads(
        tool.project_run_tool({"action": "queue", "workspace": str(project)})
    )["error"]


def test_failures_return_json_instead_of_raising(project, monkeypatch):
    tool = load_tool()
    tool._modules["project_runs"] = type(
        "Broken",
        (),
        {
            "dispatch_blocked_reason": staticmethod(lambda: None),
            "project_run_state": staticmethod(lambda _w: (_ for _ in ()).throw(RuntimeError("db locked"))),
        },
    )
    out = json.loads(tool.project_run_tool({"action": "status", "workspace": str(project)}))
    assert out == {"ok": False, "error": "RuntimeError: db locked"}


def test_result_size_is_bounded(project):
    tool = load_tool()
    tool._modules["project_runs"] = type(
        "Huge",
        (),
        {
            "dispatch_blocked_reason": staticmethod(lambda: None),
            "project_run_state": staticmethod(lambda _w: {"tasks": [{"pad": "x" * 500}] * 100}),
        },
    )
    out = tool.project_run_tool({"action": "status", "workspace": str(project), "summary": False})
    assert len(out) <= tool._MAX_RESULT_CHARS
    assert out.endswith("one job at a time]")


def test_worker_call_that_reaches_the_handler_cannot_queue_or_control(project, monkeypatch):
    """Hiding the schema is not enough; a worker-originated call must be refused."""
    tool = load_tool()
    monkeypatch.setenv("HERMES_KANBAN_TASK", "t_review_worker")

    queued = json.loads(
        tool.project_run_tool({"action": "queue", "workspace": str(project), "phases": "sw-architect"})
    )
    assert queued["ok"] is False and "cannot queue" in queued["error"]
    paused = json.loads(tool.project_run_tool({"action": "pause", "workspace": str(project)}))
    assert paused["ok"] is False

    monkeypatch.delenv("HERMES_KANBAN_TASK")
    status = json.loads(tool.project_run_tool({"action": "status", "workspace": str(project)}))
    assert status["task_count"] == 0


def test_hidden_from_workers_and_delegated_children(monkeypatch):
    tool = load_tool()
    monkeypatch.delenv("HERMES_KANBAN_TASK", raising=False)
    assert tool.coordinator_only() is True

    monkeypatch.setenv("HERMES_KANBAN_TASK", "t_123")
    assert tool.coordinator_only() is False

    monkeypatch.delenv("HERMES_KANBAN_TASK", raising=False)
    import agent.delegation_context as delegation_context

    monkeypatch.setattr(delegation_context, "is_delegated_child_context", lambda: True)
    assert tool.coordinator_only() is False


def test_subprocess_lineage_blocks_mutation_but_not_status(project, monkeypatch):
    from agent.delegation_context import DELEGATED_CHILD_ENV_MARKER

    tool = load_tool()
    monkeypatch.setenv(DELEGATED_CHILD_ENV_MARKER, "1")
    assert tool.coordinator_only() is False
    for action in ("queue", "pause", "resume", "stop"):
        result = json.loads(tool.project_run_tool({
            "action": action, "workspace": str(project), "phases": "sw-architect",
        }))
        assert result["ok"] is False
        assert "delegated helper" in result["error"]
    # Exercise the shared API used by the CLI, not only the model-tool guard.
    runs = tool._sibling("project_runs")
    with pytest.raises(PermissionError, match="delegated helper"):
        runs.queue_project_run(project, ["sw-architect"])
    for action in ("pause", "resume", "stop"):
        with pytest.raises(PermissionError, match="delegated helper"):
            runs.control_project_run(project, action)
    status = json.loads(tool.project_run_tool({"action": "status", "workspace": str(project)}))
    assert status["task_count"] == 0


def test_plugin_registers_the_tool_in_the_guide_bundle():
    class Context:
        def __init__(self):
            self.tools = []
            self.skills = []
            self.commands = []

        def register_skill(self, name, path, description=""):
            self.skills.append(name)

        def register_command(self, name, handler, description="", args_hint=""):
            self.commands.append(name)

        def register_cli_command(self, name, **kwargs):
            self.commands.append(name)

        def register_tool(self, **kwargs):
            self.tools.append(kwargs)

        def inject_message(self, prompt):
            return True

    ctx = Context()
    load_plugin().register(ctx)

    (tool,) = ctx.tools
    assert tool["name"] == "project_run"
    assert tool["toolset"] == "project-guide"
    assert tool["schema"]["name"] == "project_run"
    assert set(tool["schema"]["parameters"]["required"]) == {"action", "workspace"}
    assert callable(tool["check_fn"]) and callable(tool["handler"])
