"""Focused QA uses real Hermes storage, dependency gates and recovery paths."""

from __future__ import annotations

import argparse
import importlib.util
import json
from pathlib import Path
from types import SimpleNamespace

import pytest


ROOT = Path(__file__).resolve().parents[1]


def load(name):
    spec = importlib.util.spec_from_file_location(f"focused_qa_{name}", ROOT / f"{name}.py")
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.fixture
def project(tmp_path, monkeypatch):
    monkeypatch.setenv("HERMES_HOME", str(tmp_path / "profile"))
    monkeypatch.setenv("HERMES_KANBAN_HOME", str(tmp_path / "board"))
    monkeypatch.delenv("HERMES_KANBAN_TASK", raising=False)
    workspace = tmp_path / "project"
    workspace.mkdir()
    return workspace


def saved_tasks(runs, queued):
    with runs.kb.connect_closing() as conn:
        return [runs.kb.get_task(conn, row["task_id"]) for row in queued["tasks"]]


def finish(runs, task_id):
    with runs.kb.connect_closing() as conn:
        claimed = runs.kb.claim_task(conn, task_id)
        assert claimed
        assert runs.kb.complete_task(
            conn, task_id, summary="Scoped checks verified; retained evidence",
            expected_run_id=claimed.current_run_id,
        )
        runs.kb.recompute_ready(conn)


@pytest.mark.parametrize("profile", ["personal", "reusable", "production"])
def test_profile_selects_skills_and_only_final_job_can_finish_phase(project, profile):
    runs = load("project_runs")
    result = runs.queue_project_run(
        project, ["qa-engineer", "tech-writer"], build_profile=profile,
        models={"qa-engineer": "selected-model"}, providers={"qa-engineer": "selected-provider"},
    )
    tasks = saved_tasks(runs, result)
    qa, docs = tasks[:-1], tasks[-1]
    expected = ["functional"] if profile == "personal" else ["functional", "experience"]
    assert [task.skills for task in qa] == [
        ["ultimate-builder:qa-evidence", f"ultimate-builder:qa-{scope}"] for scope in expected
    ]
    for index, task in enumerate(qa):
        assert f"Build profile: {profile}" in task.body
        assert task.model_override == "selected-model"
        assert task.provider_override == "selected-provider"
        assert ("Only this final QA stage" in task.body) == (index == len(qa) - 1)
        with runs.kb.connect_closing() as conn:
            assert runs.kb.claim_task(conn, docs.id) is None
            if index + 1 < len(qa):
                assert runs.kb.claim_task(conn, qa[index + 1].id) is None
        finish(runs, task.id)
    with runs.kb.connect_closing() as conn:
        assert runs.kb.claim_task(conn, docs.id)


@pytest.mark.parametrize("profile", ["personal", "reusable", "production"])
def test_reopen_keeps_plan_body_and_skills_even_when_profile_omitted_or_changed(project, profile):
    runs = load("project_runs")
    first = runs.queue_project_run(project, ["qa-engineer"], build_profile=profile)
    before = [(task.id, task.body, task.skills) for task in saved_tasks(runs, first)]
    for new_profile in (None, "personal", "production"):
        reopened = runs.queue_project_run(project, ["qa-engineer"], build_profile=new_profile)
        assert all(row["reused"] for row in reopened["tasks"])
        assert [(task.id, task.body, task.skills) for task in saved_tasks(runs, reopened)] == before


def test_failed_functional_attempt_cannot_unlock_experience_or_documentation(project):
    runs = load("project_runs")
    result = runs.queue_project_run(project, ["qa-engineer", "tech-writer"], build_profile="reusable")
    tasks = saved_tasks(runs, result)
    with runs.kb.connect_closing() as conn:
        attempt = runs.kb.claim_task(conn, tasks[0].id)
        runs.kb._record_task_failure(
            conn, attempt.id, "Browser checks failed", outcome="failed",
            release_claim=True, end_run=True, expected_run_id=attempt.current_run_id,
            run_summary="Retained failing browser output; next: bounded repair",
        )
        for task in tasks[1:]:
            assert runs.kb.claim_task(conn, task.id) is None
        assert "Retained failing browser output" in runs.kb.build_worker_context(conn, attempt.id)


def test_optional_experience_is_included_and_survives_reopen(project):
    runs = load("project_runs")
    queued = runs.queue_project_run(project, ["qa-engineer"], build_profile="personal", qa_experience=True)
    first, final = saved_tasks(runs, queued)
    assert "Only this final QA stage" not in first.body
    assert "Only this final QA stage" in final.body
    assert final.skills[-1] == "ultimate-builder:qa-experience"
    assert "Personal QA execution contract" not in final.body
    reopened = runs.queue_project_run(project, ["qa-engineer"])
    assert [row["task_id"] for row in reopened["tasks"]] == [first.id, final.id]


def test_scope_expansion_requires_fresh_pass_after_existing_jobs_finish(project, monkeypatch):
    runs = load("project_runs")
    # Hold the old second-resolution run-token clock still. This must create a
    # fresh parent even if every queue request happens within the same second.
    monkeypatch.setattr(runs, "time", SimpleNamespace(time=lambda: 1_800_000_000))
    first = runs.queue_project_run(project, ["qa-engineer"], build_profile="personal")
    original = saved_tasks(runs, first)[0]
    for force_new in (False, True):
        with pytest.raises(ValueError, match="Finish the current pass"):
            runs.queue_project_run(project, ["qa-engineer"], qa_experience=True, force_new=force_new)
    finish(runs, original.id)
    with pytest.raises(ValueError, match="force_new"):
        runs.queue_project_run(project, ["qa-engineer"], qa_experience=True)
    expanded = runs.queue_project_run(project, ["qa-engineer"], qa_experience=True, force_new=True)
    tasks = saved_tasks(runs, expanded)
    assert len(tasks) == 2 and original.id not in {task.id for task in tasks}
    assert "Only this final QA stage" not in tasks[0].body
    with runs.kb.connect_closing() as conn:
        assert runs.kb.get_task(conn, original.id).body == original.body
        assert runs.kb.claim_task(conn, tasks[-1].id) is None
    reopened = runs.queue_project_run(project, ["qa-engineer"])
    assert [row["task_id"] for row in reopened["tasks"]] == [task.id for task in tasks]


@pytest.mark.parametrize("legacy_profile", [None, "personal"])
def test_legacy_queued_bodies_skills_and_dependencies_are_not_replaced(project, legacy_profile):
    runs = load("project_runs")
    legacy = load("project_work_units").load_qa_work_units(legacy_profile)
    original = []
    parents = []
    with runs.kb.connect_closing() as conn:
        for unit in legacy["units"]:
            task_id = runs.kb.create_task(
                conn, title=unit["title"], body=f"Original saved scope {unit['id']}",
                assignee="default", workspace_kind="dir", workspace_path=str(project),
                parents=parents, skills=["ultimate-builder:qa-engineer"],
                idempotency_key=f"{runs.WORK_UNIT_KEY_PREFIX}{runs._workspace_digest(project)}:qa-engineer:{unit['id']}:old",
            )
            parents = [task_id]
            task = runs.kb.get_task(conn, task_id)
            original.append((task.id, task.body, task.skills))
    queued = runs.queue_project_run(project, ["qa-engineer"], build_profile="production")
    assert [(task.id, task.body, task.skills) for task in saved_tasks(runs, queued)] == original


def test_cli_and_tool_carry_personal_experience_opt_in(project, capsys):
    cli = load("project_run_cli")
    parser = argparse.ArgumentParser()
    cli.setup_parser(parser)
    cli.handle(parser.parse_args([
        "queue", "--workspace", str(project), "--phases", "qa-engineer",
        "--build-profile", "personal", "--qa-experience",
    ]))
    first = json.loads(capsys.readouterr().out)
    tool = load("project_run_tool")
    second = json.loads(tool.project_run_tool({
        "action": "queue", "workspace": str(project), "phases": "qa-engineer",
        "build_profile": "personal", "qa_experience": True,
    }))
    assert len(first["tasks"]) == 2
    assert [row["task_id"] for row in first["tasks"]] == [row["task_id"] for row in second["tasks"]]


@pytest.mark.parametrize("bad", ["false", 1, None])
def test_malformed_opt_in_is_rejected_before_creating_jobs(project, bad):
    tool = load("project_run_tool")
    result = json.loads(tool.project_run_tool({
        "action": "queue", "workspace": str(project), "phases": "qa-engineer",
        "build_profile": "personal", "qa_experience": bad,
    }))
    assert not result["ok"] and "boolean" in result["error"]
    assert load("project_runs").project_run_state(project)["tasks"] == []


def test_qa_control_and_workspace_isolation_use_existing_phase_identity(project):
    runs = load("project_runs")
    one = runs.queue_project_run(project, ["qa-engineer"], build_profile="reusable")
    other = project.parent / "other"
    other.mkdir()
    two = runs.queue_project_run(other, ["qa-engineer"], build_profile="personal")
    runs.control_project_run(project, "pause")
    # Pause blocks the ready parent; its dependent remains gated in todo.
    assert [task.status for task in saved_tasks(runs, one)] == ["blocked", "todo"]
    with runs.kb.connect_closing() as conn:
        assert runs.kb.claim_task(conn, one["tasks"][1]["task_id"]) is None
    assert saved_tasks(runs, two)[0].status == "ready"
    runs.control_project_run(project, "resume")
    assert [task.status for task in saved_tasks(runs, one)] == ["ready", "todo"]
    runs.control_project_run(project, "stop")
    assert all(task.status == "archived" for task in saved_tasks(runs, one))
    assert saved_tasks(runs, two)[0].status == "ready"
