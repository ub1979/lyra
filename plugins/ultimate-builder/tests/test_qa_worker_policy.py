"""QA role vetoes through real plugin registration, storage and tool dispatch."""

import importlib.util
import json
from pathlib import Path

import pytest

from hermes_cli import kanban_db as kb
from hermes_cli import plugins
from model_tools import handle_function_call


@pytest.fixture
def qa(tmp_path, monkeypatch):
    monkeypatch.setenv("HERMES_HOME", str(tmp_path / "home"))
    monkeypatch.setenv("HERMES_KANBAN_HOME", str(tmp_path / "board"))
    project = tmp_path / "project"
    project.mkdir()
    monkeypatch.chdir(project)
    manager = plugins.PluginManager()
    spec = importlib.util.spec_from_file_location(
        "qa_policy_plugin", Path(__file__).resolve().parents[1] / "__init__.py",
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    module.register(plugins.PluginContext(plugins.PluginManifest(name="ultimate-builder"), manager))
    manager._discovered = True
    monkeypatch.setattr(plugins, "_plugin_manager", manager)
    with kb.connect_closing() as conn:
        tid = kb.create_task(conn, title="QA", assignee="default", goal_mode=True,
                             workspace_kind="dir", workspace_path=str(project),
                             skills=["ultimate-builder:qa-evidence", "ultimate-builder:qa-functional"])
        task = kb.claim_task(conn, tid)
    monkeypatch.setenv("HERMES_KANBAN_TASK", tid)
    monkeypatch.setenv("HERMES_KANBAN_RUN_ID", str(task.current_run_id))
    return project, tid


@pytest.mark.parametrize("tool", ["kanban_create", "kanban_link", "kanban_unblock"])
def test_qa_cannot_schedule_or_rewire_workers(qa, tool):
    project, tid = qa
    result = json.loads(handle_function_call(tool, {
        "title": "repair", "assignee": "default", "parents": [tid],
        "workspace_kind": "dir", "workspace_path": str(project),
    }, enabled_tools=[tool]))
    assert "QA cannot schedule" in result["error"]
    with kb.connect_closing() as conn:
        assert [task.id for task in kb.list_tasks(conn)] == [tid]
        assert kb.parent_ids(conn, tid) == []


@pytest.mark.parametrize("tool,args", [
    ("write_file", {"path": "js/app.js", "content": "bad repair"}),
    ("patch", {"path": "js/app.js", "old_string": "original", "new_string": "repair"}),
    ("patch", {"mode": "patch", "patch": "*** Begin Patch\n*** Add File: tests/new.test.js\n+ok\n*** Update File: js/app.js\n@@\n-original\n+repair\n*** End Patch"}),
    ("patch", {"mode": "patch", "patch": "*** Begin Patch\n*** Move File: tests/fixture.js -> js/app.js\n*** End Patch"}),
])
def test_source_edits_are_vetoed_before_mutation(qa, tool, args):
    project, _ = qa
    (project / "js").mkdir()
    source = project / "js/app.js"
    source.write_text("original", encoding="utf-8")
    result = json.loads(handle_function_call(tool, args, enabled_tools=[tool]))
    assert "QA may edit tests and evidence" in result["error"]
    assert source.read_text(encoding="utf-8") == "original"
    assert not (project / "tests/new.test.js").exists()


@pytest.mark.parametrize("path", [".sdlc/qa-functional.md", "bug-report.md", "tests/app.test.js", "src/app.spec.ts", "e2e/smoke.py"])
def test_tests_and_evidence_remain_available(qa, path):
    assert plugins.get_pre_tool_call_block_message("write_file", {"path": path, "content": "test"}) is None


def test_symlink_cannot_turn_evidence_edit_into_source_repair(qa):
    project, _ = qa
    (project / "src").mkdir()
    (project / "tests").symlink_to(project / "src", target_is_directory=True)
    assert plugins.get_pre_tool_call_block_message("write_file", {"path": "tests/app.js"})


def test_qa_handoff_stays_blocked_across_dispatcher_ticks(qa):
    _, tid = qa
    result = json.loads(handle_function_call("kanban_block", {
        "kind": "needs_input", "reason": "Coordinator: repair FR-006; rerun J6 only",
    }, enabled_tools=["kanban_block"]))
    assert result["ok"] and result["status"] == "blocked"
    with kb.connect_closing() as conn:
        for _ in range(3):
            kb.recompute_ready(conn)
            assert kb.claim_task(conn, tid) is None
        assert kb.get_task(conn, tid).status == "blocked"


@pytest.mark.parametrize("role", ["coordinator", "developer", "hermes-orchestrator"])
def test_other_roles_keep_their_tools(qa, monkeypatch, role):
    _, tid = qa
    if role == "coordinator":
        monkeypatch.delenv("HERMES_KANBAN_TASK")
    else:
        skills = ["ultimate-builder:sw-developer"] if role == "developer" else []
        with kb.connect_closing() as conn, kb.write_txn(conn):
            conn.execute("UPDATE tasks SET skills=? WHERE id=?", (json.dumps(skills), tid))
    assert plugins.get_pre_tool_call_block_message("kanban_create", {}) is None
    assert plugins.get_pre_tool_call_block_message("patch", {"path": "js/app.js"}) is None


def test_terminal_test_commands_are_available(qa):
    assert plugins.get_pre_tool_call_block_message("terminal", {"command": "npm test"}) is None


def test_agent_loop_delegation_uses_the_same_hook(qa):
    # delegate_task is intercepted by AIAgent before model_tools dispatch.
    assert "QA cannot schedule" in plugins.resolve_pre_tool_block("delegate_task", {"goal": "repair"})


def test_file_policy_uses_the_actual_session_working_directory(qa):
    from tools.terminal_tool import record_session_cwd, clear_session_cwd

    project, _ = qa
    try:
        record_session_cwd("qa-session", str(project / "tests"))
        assert plugins.resolve_pre_tool_block("write_file", {"path": "fixture.js"}, task_id="qa-session") is None
        record_session_cwd("qa-session", str(project / "src"))
        assert plugins.resolve_pre_tool_block("write_file", {"path": "app.js"}, task_id="qa-session")
    finally:
        clear_session_cwd("qa-session")
