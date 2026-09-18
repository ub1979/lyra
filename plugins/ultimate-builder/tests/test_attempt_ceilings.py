"""Development jobs carry their profile's attempt ceiling; planned profiles need a plan.

Plan revision 6, Slice 4b: Personal keeps the 90-call safety limit, Reusable
work items get 90, Production work items get 180, and neither Reusable nor
Production may queue one whole-application Development job.
"""

from __future__ import annotations

import importlib.util
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
GRAPH = """# Build plan

### TG-001 — Build task storage
**Depends on:** architecture approval.
**Work:** Implement only task storage and its tests.

### TG-002 — Add the task screen
**Depends on:** TG-001.
**Work:** Implement only the task screen and its tests.
"""


def _load(name: str):
    spec = importlib.util.spec_from_file_location(f"ub_ceiling_test_{name}", ROOT / f"{name}.py")
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)
    return module


@pytest.fixture
def project(tmp_path, monkeypatch):
    monkeypatch.setenv("HERMES_HOME", str(tmp_path / "home"))
    monkeypatch.setenv("HERMES_KANBAN_HOME", str(tmp_path / "board"))
    monkeypatch.delenv("HERMES_KANBAN_TASK", raising=False)
    workspace = tmp_path / "project"
    workspace.mkdir()
    helper_spec = importlib.util.spec_from_file_location(
        "ub_ceiling_preview_helper", Path(__file__).with_name("preview_approval.py")
    )
    helper = importlib.util.module_from_spec(helper_spec)
    assert helper_spec and helper_spec.loader
    helper_spec.loader.exec_module(helper)
    helper.approve_preview(workspace)
    return workspace


def _ceilings(runs, queued):
    with runs.kb.connect_closing() as conn:
        return {
            (task["phase"], task["work_item_id"]):
                runs.kb.get_task(conn, task["task_id"]).max_agent_iterations
            for task in queued["tasks"]
        }


def test_personal_whole_app_worker_keeps_the_90_call_safety_limit(project):
    runs = _load("project_runs")

    queued = runs.queue_project_run(project, ["sw-developer"], build_profile="personal")

    assert _ceilings(runs, queued) == {("sw-developer", None): 90}


@pytest.mark.parametrize(("profile", "ceiling"), [("reusable", 90), ("production", 180)])
def test_planned_profiles_give_each_work_item_its_ceiling(project, profile, ceiling):
    (project / "task-graph.md").write_text(GRAPH, encoding="utf-8")
    runs = _load("project_runs")

    queued = runs.queue_project_run(project, ["sw-developer"], build_profile=profile)

    assert _ceilings(runs, queued) == {
        ("sw-developer", "TG-001"): ceiling, ("sw-developer", "TG-002"): ceiling,
    }


@pytest.mark.parametrize("profile", ["reusable", "production"])
def test_planned_profiles_refuse_a_whole_application_job(project, profile):
    runs = _load("project_runs")

    with pytest.raises(ValueError, match="Task planning first"):
        runs.queue_project_run(project, ["task-planner", "sw-developer"], build_profile=profile)

    assert runs._project_tasks(project) == []


def test_legacy_projects_and_non_development_phases_are_unchanged(project):
    runs = _load("project_runs")

    legacy = runs.queue_project_run(project, ["sw-developer"])
    planner = runs.queue_project_run(project, ["task-planner"], build_profile="production")

    assert _ceilings(runs, legacy) == {("sw-developer", None): None}
    assert _ceilings(runs, planner) == {("task-planner", None): None}


def test_existing_development_is_exempt_from_the_plan_requirement(project):
    runs = _load("project_runs")
    runs.queue_project_run(project, ["sw-developer"])

    again = runs.queue_project_run(project, ["sw-developer"], build_profile="production")

    assert again["tasks"]
