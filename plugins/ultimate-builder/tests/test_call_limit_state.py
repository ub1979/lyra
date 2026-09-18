"""A job that stops at its call limit is shown as such, and continues once from its handoff.

Trial 3: the Development job hit 90/90 calls; the runtime saved a 2,727-character
handoff and returned the job to "ready", where Studio and the coordinator
showed it as an ordinary healthy queued job.
"""

from __future__ import annotations

import importlib.util
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
EXHAUSTED = "Iteration budget exhausted (90/90) — task could not complete within the allowed iterations"


def _load(name: str):
    spec = importlib.util.spec_from_file_location(f"ub_call_limit_test_{name}", ROOT / f"{name}.py")
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)
    return module


@pytest.mark.parametrize(("status", "expected"), [
    ("ready", "continuing"), ("running", "continuing"),
    ("blocked", "needs_decision"), ("done", None), ("archived", None),
])
def test_call_limit_stops_are_classified_by_job_state(status, expected):
    result = _load("call_limit_state").call_limit_state(status, EXHAUSTED)

    assert (result or {}).get("state") == expected


def test_other_failures_are_not_call_limit_stops():
    module = _load("call_limit_state")

    assert module.call_limit_state("ready", "elapsed 3000s > limit 2700s") is None
    assert module.call_limit_state("blocked", None) is None


@pytest.fixture
def project(tmp_path, monkeypatch):
    monkeypatch.setenv("HERMES_HOME", str(tmp_path / "home"))
    monkeypatch.setenv("HERMES_KANBAN_HOME", str(tmp_path / "board"))
    monkeypatch.delenv("HERMES_KANBAN_TASK", raising=False)
    workspace = tmp_path / "project"
    workspace.mkdir()
    return workspace


def _exhaust(runs, task_id: str, summary: str) -> None:
    """Record a call-limit stop exactly as the runtime's turn finalizer does."""
    from agent.worker_handoff import exhaustion_handoff

    with runs.kb.connect_closing() as conn:
        claimed = runs.kb.claim_task(conn, task_id)
        assert claimed
        runs.kb._record_task_failure(
            conn, task_id, error=EXHAUSTED, outcome="timed_out",
            release_claim=True, end_run=True,
            run_summary=exhaustion_handoff(summary),
            expected_run_id=claimed.current_run_id,
        )


def test_first_stop_continues_once_from_its_handoff_then_needs_a_decision(project):
    runs = _load("project_runs")
    summary_module = __import__("hermes_cli.project_run_summary", fromlist=["x"])
    task_id = runs.queue_project_run(project, ["sw-architect"])["tasks"][0]["task_id"]

    _exhaust(runs, task_id, "Changed: plan.md. Open: data model. Next: write risks section.")

    state = runs.project_run_state(project)
    job = state["tasks"][0]
    assert job["status"] == "ready"
    assert job["call_limit"]["state"] == "continuing"
    assert summary_module.summarize_project_run(state)["active_jobs"][0]["call_limit"]["state"] == "continuing"
    with runs.kb.connect_closing() as conn:
        context = runs.kb.build_worker_context(conn, task_id)
    assert "Next: write risks section" in context and "NOT completion" in context

    _exhaust(runs, task_id, "Still open: data model.")

    job = runs.project_run_state(project)["tasks"][0]
    assert job["status"] == "blocked"
    assert job["call_limit"]["state"] == "needs_decision"


def test_project_map_says_the_job_stopped_instead_of_queued_safely(project):
    runs = _load("project_runs")
    progress = _load("project_progress")
    task_id = runs.queue_project_run(project, ["sw-architect"])["tasks"][0]["task_id"]
    _exhaust(runs, task_id, "Next: finish plan.")

    merged = progress._merge_project_run_state(
        {"phases": []}, runs.project_run_state(project), project
    )

    status = next(p for p in merged["phases"] if p["id"] == "sw-architect")["status"]
    assert "call limit" in status
    assert "queued safely" not in status
