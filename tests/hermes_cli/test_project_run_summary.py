"""Small live status preserves decisions, isolation and detailed CLI access."""

import argparse
from copy import deepcopy
import importlib.util
import json
from pathlib import Path

from hermes_cli.project_run_summary import summarize_project_run


def test_bounded_summary_keeps_all_counts_attention_and_explicit_omissions():
    tasks = [
        {
            "task_id": str(i),
            "status": "done",
            "label": "Completed work",
            "last_error": "x" * 4000,
        }
        for i in range(100)
    ]
    tasks += [
        {
            "task_id": f"blocked-{i}",
            "status": "blocked",
            "attention_kind": "input",
            "wait_reason": "q" * 4000,
        }
        for i in range(10)
    ]
    tasks.append({
        "task_id": "stalled",
        "status": "running",
        "activity_health": "stalled",
    })
    state = {"state": "needs_attention", "active": True, "tasks": tasks}
    original = deepcopy(state)
    summary = summarize_project_run(state)
    assert summary["state"] == "needs_attention"
    assert summary["status_counts"] == {"done": 100, "blocked": 10, "running": 1}
    assert summary["attention_count"] == 11
    assert summary["omitted"] == {
        "active_jobs": 0,
        "attention_jobs": 3,
        "completed_jobs": 99,
    }
    assert summary["active_jobs"][0]["activity_health"] == "stalled"
    assert "wait_reason" in summary["attention_jobs"][0]["truncated_fields"]
    assert len(json.dumps(summary)) < len(json.dumps(state)) / 10
    assert state == original


def test_cli_summary_reads_real_jobs_and_keeps_detailed_mode(
    tmp_path, monkeypatch, capsys
):
    monkeypatch.setenv("HERMES_KANBAN_HOME", str(tmp_path / "home"))
    spec = importlib.util.spec_from_file_location(
        "project_summary_cli",
        Path(__file__).resolve().parents[2]
        / "plugins/ultimate-builder/project_run_cli.py",
    )
    cli = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(cli)
    parser = argparse.ArgumentParser()
    cli.setup_parser(parser)
    runs = cli._project_runs_module()
    project = tmp_path / "project"
    other = tmp_path / "other"
    project.mkdir()
    other.mkdir()
    queued = runs.queue_project_run(project, ["researcher", "sw-architect"])
    alien = runs.queue_project_run(other, ["researcher"])["tasks"][0]["task_id"]
    research = queued["tasks"][0]["task_id"]
    with runs.kb.connect_closing() as conn:
        assert runs.kb.claim_task(conn, research)
    for summary_flag in ([], ["--summary"]):
        cli.handle(
            parser.parse_args(["status", "--workspace", str(project), *summary_flag])
        )
        output = capsys.readouterr().out
        result = json.loads(output)
        assert alien not in output
        assert result["state"] == "working"
        assert result["task_count"] == 2
        if summary_flag:
            assert result["active_jobs"][0]["task_id"] == research
            assert result["status_counts"] == {"running": 1, "todo": 1}
        else:
            assert len(result["tasks"]) == 2
    # A fresh summary must expose a pause immediately, not cache old liveness.
    runs.control_project_run(project, "pause")
    cli.handle(parser.parse_args(["status", "--workspace", str(project), "--summary"]))
    paused = json.loads(capsys.readouterr().out)
    assert paused["state"] == "needs_attention"
    # Dependent todo work remains queued behind the paused predecessor.
    assert paused["attention_count"] == 1
    assert paused["status_counts"] == {"blocked": 1, "todo": 1}
    assert all(task["paused_by_user"] for task in paused["attention_jobs"])
