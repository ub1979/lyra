"""Every coordinator-facing job result says whether saved jobs can start.

Trial 3: the coordinator told the user a queued job would start shortly and
that it had "nudged the scheduler", while no dispatcher was running.
"""

from __future__ import annotations

import importlib.util
import json
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]


def _load(name: str):
    spec = importlib.util.spec_from_file_location(f"ub_runner_test_{name}", ROOT / f"{name}.py")
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)
    return module


@pytest.fixture
def project(tmp_path, monkeypatch):
    monkeypatch.setenv("HERMES_HOME", str(tmp_path / "home"))
    monkeypatch.setenv("HERMES_KANBAN_HOME", str(tmp_path / "board"))
    monkeypatch.delenv("HERMES_KANBAN_TASK", raising=False)
    monkeypatch.delenv("HERMES_KANBAN_DISPATCH_IN_GATEWAY", raising=False)
    workspace = tmp_path / "project"
    workspace.mkdir()
    return workspace


def test_without_a_dispatcher_queue_status_and_resume_report_it(project, monkeypatch):
    import gateway.status

    monkeypatch.setattr(gateway.status, "get_running_pid", lambda *a, **k: None)
    tool = _load("project_run_tool")

    queued = json.loads(tool.project_run_tool(
        {"action": "queue", "workspace": str(project), "phases": "sw-architect"}
    ))
    summary = json.loads(tool.project_run_tool({"action": "status", "workspace": str(project)}))
    resumed = json.loads(tool.project_run_tool({"action": "resume", "workspace": str(project)}))

    for result in (queued, summary, resumed):
        assert result["job_runner"]["state"] == "unavailable"
        assert "cannot start yet" in result["job_runner"]["message"]


def test_a_fresh_dispatcher_tick_reports_running(project):
    from hermes_cli.kanban_dispatcher_tick import record_tick

    record_tick(60, successful=True)
    runs = _load("project_runs")

    assert runs.project_run_state(project)["job_runner"]["state"] == "running"
