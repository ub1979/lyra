"""Real SQLite recovery through the coordinator tool, with no live workers."""

import json

import pytest

from test_project_run_tool import load_tool, project  # noqa: F401


def queued(tool, workspace):
    return json.loads(tool.project_run_tool({
        "action": "queue", "workspace": str(workspace), "phases": "researcher,sw-architect",
    }))["tasks"]


def retry(tool, workspace, task_id):
    return json.loads(tool.project_run_tool({
        "action": "retry", "workspace": str(workspace), "task_id": task_id,
        "reason": "The interrupted attempt left verified files; finish the remaining checks only.",
    }))


def test_retry_one_job_preserves_other_jobs_and_dependencies(project):
    from hermes_cli import kanban_db as kb

    tool = load_tool()
    parent, child = queued(tool, project)
    with kb.connect_closing() as conn:
        assert kb.promote_task(conn, child["task_id"], actor="test", force=True)[0]
        assert kb.block_task(conn, child["task_id"], reason="Iteration limit exhausted")
    result = retry(tool, project, child["task_id"])
    assert result["changed"] == [child["task_id"]]
    assert result["status"] == "todo"  # Not ready while its parent is unfinished.
    with kb.connect_closing() as conn:
        assert kb.get_task(conn, parent["task_id"]).status == parent["status"]
        event = kb.list_events(conn, child["task_id"])[-1]
        assert event.kind == "unblocked"
        assert "remaining checks" in event.payload["reason"]
        assert "remaining checks" in kb.list_comments(conn, child["task_id"])[-1].body
        assert "remaining checks" in kb.build_worker_context(conn, child["task_id"])
    assert retry(tool, project, child["task_id"])["changed"] == []


def test_retry_independent_failed_job_becomes_ready(project):
    from hermes_cli import kanban_db as kb

    tool = load_tool()
    task = queued(tool, project)[0]["task_id"]
    with kb.connect_closing() as conn:
        assert kb.block_task(conn, task, reason="Iteration limit exhausted")
    assert retry(tool, project, task)["status"] == "ready"


def test_cli_uses_the_same_recovery_path(project, capsys):
    import argparse
    from hermes_cli import kanban_db as kb

    tool = load_tool()
    task = queued(tool, project)[0]["task_id"]
    with kb.connect_closing() as conn:
        assert kb.block_task(conn, task, reason="Iteration limit exhausted")
    cli = tool._sibling("project_run_cli")
    parser = argparse.ArgumentParser()
    cli.setup_parser(parser)
    cli.handle(parser.parse_args([
        "retry", "--workspace", str(project), "--task-id", task,
        "--reason", "Finish only the outstanding verification",
    ]))
    assert json.loads(capsys.readouterr().out)["changed"] == [task]


def test_failed_write_rolls_back_status_and_recovery_comment(project, monkeypatch):
    from hermes_cli import kanban_db as kb

    tool = load_tool()
    task = queued(tool, project)[0]["task_id"]
    with kb.connect_closing() as conn:
        assert kb.block_task(conn, task, reason="Iteration limit exhausted")
        before = kb.list_comments(conn, task)
    original = kb._append_event

    def fail_event(conn, task_id, kind, *args, **kwargs):
        if kind == "unblocked":
            raise OSError("controlled write failure")
        return original(conn, task_id, kind, *args, **kwargs)

    monkeypatch.setattr(kb, "_append_event", fail_event)
    assert not retry(tool, project, task)["ok"]
    with kb.connect_closing() as conn:
        assert kb.get_task(conn, task).status == "blocked"
        assert kb.list_comments(conn, task) == before


@pytest.mark.parametrize("reason,kind", [("review-required: independent review", None), ("Need a user choice", "needs_input")])
def test_retry_cannot_bypass_review_or_user_input(project, reason, kind):
    from hermes_cli import kanban_db as kb

    tool = load_tool()
    task = queued(tool, project)[0]["task_id"]
    with kb.connect_closing() as conn:
        kb.block_task(conn, task, reason=reason, kind=kind)
    assert not retry(tool, project, task)["ok"]
    with kb.connect_closing() as conn:
        assert kb.get_task(conn, task).status == "blocked"


def test_retry_rejects_another_project_and_worker_role(project, monkeypatch):
    from hermes_cli import kanban_db as kb

    tool = load_tool()
    task = queued(tool, project)[0]["task_id"]
    with kb.connect_closing() as conn:
        kb.block_task(conn, task, reason="Iteration limit exhausted")
    other = project.parent / "other"
    other.mkdir()
    assert not retry(tool, other, task)["ok"]
    monkeypatch.setenv("HERMES_KANBAN_TASK", "worker")
    assert not retry(tool, project, task)["ok"]
    with pytest.raises(PermissionError):
        tool._sibling("project_runs").retry_project_task(project, task, "try again")


def test_concurrent_review_block_invalidates_old_recovery_decision(project, monkeypatch):
    from hermes_cli import kanban_db as kb

    tool = load_tool()
    task = queued(tool, project)[0]["task_id"]
    with kb.connect_closing() as conn:
        kb.block_task(conn, task, reason="Iteration limit exhausted")
    original = kb.unblock_task

    def concurrent_block(conn, task_id, **kwargs):
        # A second connection writes after the recovery decision was read.
        with kb.connect_closing() as writer:
            assert original(writer, task_id)
            assert kb.block_task(writer, task_id, reason="review-required: newer evidence", kind="needs_input")
        return original(conn, task_id, **kwargs)

    monkeypatch.setattr(kb, "unblock_task", concurrent_block)
    result = retry(tool, project, task)
    assert result["changed"] == []
    with kb.connect_closing() as conn:
        assert kb.get_task(conn, task).status == "blocked"
        assert kb.list_events(conn, task)[-1].kind == "blocked"
