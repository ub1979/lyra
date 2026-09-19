"""Coverage reporting uses real project files and the real Kanban queue.

These checks deliberately do not treat a passing report as independent proof.
"""

import importlib.util
import json
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]


def load(name):
    spec = importlib.util.spec_from_file_location(f"qa_acceptance_test_{name}", ROOT / f"{name}.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.fixture
def project(tmp_path, monkeypatch):
    monkeypatch.setenv("HERMES_HOME", str(tmp_path / "home"))
    monkeypatch.setenv("HERMES_KANBAN_HOME", str(tmp_path / "board"))
    monkeypatch.delenv("HERMES_KANBAN_TASK", raising=False)
    path = tmp_path / "project"
    path.mkdir()
    (path / "requirements.md").write_text(
        "| ID | Requirement |\n|---|---|\n| FR-001 | Save a note |\n"
        "| NFR-004 | Body-text contrast meets the approved target |\n",
        encoding="utf-8",
    )
    return path


def queue(project, profile="personal", **kwargs):
    runs = load("project_runs")
    result = runs.queue_project_run(project, ["qa-engineer"], build_profile=profile, **kwargs)
    with runs.kb.connect_closing() as conn:
        tasks = [runs.kb.get_task(conn, row["task_id"]) for row in result["tasks"]]
    return runs, tasks


def finish(runs, task):
    with runs.kb.connect_closing() as conn:
        claimed = runs.kb.claim_task(conn, task.id)
        assert claimed
        assert runs.kb.complete_task(conn, task.id, summary="Work item finished",
                                    expected_run_id=claimed.current_run_id)
        runs.kb.recompute_ready(conn)


def contract(task):
    prefix = "Lyra QA coverage contract: "
    return json.loads(next(line[len(prefix):] for line in task.body.splitlines() if line.startswith(prefix)))


def write_report(project, task, status="PASS"):
    pinned = contract(task)
    evidence = project / ".sdlc/evidence/raw.txt"
    evidence.parent.mkdir(parents=True, exist_ok=True)
    evidence.write_text("Recorded test output, not proof of every claim", encoding="utf-8")
    report = {
        "requirements_sha256": pinned["requirements_sha256"],
        "tested_revision": "fixture revision; clean product files",
        "results": [
            {"id": key, "status": status if key == "NFR-004" else "PASS",
             "evidence": [".sdlc/evidence/raw.txt"]} for key in pinned["criteria"]
        ],
    }
    path = project / pinned["report"]
    path.write_text(json.dumps(report), encoding="utf-8")
    return path, report


@pytest.mark.parametrize("status", ["BLOCKED", "FAIL", "NOT CLAIMED (not selected)", "SKIP"])
def test_personal_cannot_waive_explicit_contrast_or_trust_pass_heading(project, status):
    runs, tasks = queue(project)
    write_report(project, tasks[0], status)
    (project / "bug-report.md").write_text("PASS — all approved criteria verified", encoding="utf-8")
    finish(runs, tasks[0])
    state = runs.project_run_state(project)
    assert state["tasks"][0]["status"] == "done"  # does not rewrite worker truth
    assert state["state"] == "needs_attention"
    acceptance = state["qa_acceptance"]
    assert acceptance["status"] == "needs_review"
    assert any("NFR-004" in item for item in acceptance["issues"])
    assert "force_new=true" in acceptance["recovery"]
    from hermes_cli.project_run_summary import summarize_project_run
    assert summarize_project_run(state)["qa_acceptance"] == acceptance
    ledger = {"phases": [{"id": "qa-engineer", "label": "QA", "state": "done",
                           "status": "Verified", "evidence": "`bug-report.md`"}]}
    phase = load("project_progress")._merge_project_run_state(ledger, state, project)["phases"][0]
    assert phase["state"] == "pending" and "needs review" in phase["status"]


def test_functional_does_not_deadlock_experience_and_final_reports_coverage(project):
    runs, tasks = queue(project, "reusable")
    assert "Lyra QA coverage contract: " not in tasks[0].body
    finish(runs, tasks[0])
    assert runs.project_run_state(project)["qa_acceptance"]["status"] == "in_progress"
    write_report(project, tasks[-1])
    finish(runs, tasks[-1])  # actual dependency claim succeeds without a final report on Functional
    acceptance = runs.project_run_state(project)["qa_acceptance"]
    assert acceptance["status"] == "reported_complete"
    assert acceptance["criteria_count"] == 2
    assert "not independent approval" in acceptance["summary"]


@pytest.mark.parametrize("damage", ["missing", "malformed", "omitted", "duplicate", "escape", "symlink", "changed", "revision"])
def test_missing_stale_or_unsafe_coverage_never_passes(project, tmp_path, damage):
    runs, tasks = queue(project)
    path, report = write_report(project, tasks[0])
    if damage == "omitted":
        report["results"].pop()
    elif damage == "duplicate":
        report["results"].append(report["results"][0])
    elif damage == "revision":
        report.pop("tested_revision")
    elif damage == "escape":
        report["results"][0]["evidence"] = ["../outside.txt"]
    elif damage == "symlink":
        outside = tmp_path / "outside.txt"
        outside.write_text("outside", encoding="utf-8")
        (project / "linked.txt").symlink_to(outside)
        report["results"][0]["evidence"] = ["linked.txt"]
    elif damage == "changed":
        (project / "requirements.md").write_text("New requirements", encoding="utf-8")
    path.write_text(json.dumps(report), encoding="utf-8")
    if damage == "missing":
        path.unlink()
    elif damage == "malformed":
        path.write_text("not JSON", encoding="utf-8")
    finish(runs, tasks[0])
    assert runs.project_run_state(project)["qa_acceptance"]["status"] == "needs_review"


def test_legacy_jobs_are_not_rewritten_or_retroactively_rejected(project):
    runs, tasks = queue(project, None)
    for task in tasks:
        finish(runs, task)
    assert runs.project_run_state(project)["qa_acceptance"] is None


def test_fresh_recovery_uses_new_report_not_old_failed_matrix(project):
    runs, tasks = queue(project)
    old_path, _ = write_report(project, tasks[0], "BLOCKED")
    finish(runs, tasks[0])
    _, fresh = queue(project, force_new=True)
    assert project / contract(fresh[0])["report"] != old_path
    write_report(project, fresh[0])
    finish(runs, fresh[0])
    assert runs.project_run_state(project)["qa_acceptance"]["status"] == "reported_complete"
    assert old_path.exists()  # retained failure evidence


def test_unknown_requirements_format_needs_review_not_infinite_work(project):
    (project / "requirements.md").write_text("A simple prose brief", encoding="utf-8")
    runs, tasks = queue(project)
    finish(runs, tasks[0])
    assert runs.project_run_state(project)["qa_acceptance"]["status"] == "needs_review"
    with runs.kb.connect_closing() as conn:
        assert runs.kb.get_task(conn, tasks[0].id).status == "done"


def test_reopen_does_not_repin_requirements_or_mutate_cached_worker_body(project):
    runs, tasks = queue(project)
    (project / "requirements.md").write_text("Changed", encoding="utf-8")
    _, again = queue(project)
    assert again[0].id == tasks[0].id and again[0].body == tasks[0].body


def test_stopping_a_job_is_not_passing_qa(project):
    runs, tasks = queue(project)
    write_report(project, tasks[0])
    runs.control_project_run(project, "stop")
    assert runs.project_run_state(project)["qa_acceptance"]["status"] == "needs_review"


def test_shared_evidence_is_inspected_once_not_once_per_criterion(project, monkeypatch):
    module = load("qa_acceptance")
    runs, tasks = queue(project)
    write_report(project, tasks[0])
    calls = []
    inspect = module.inspect_evidence

    def tracked(project, paths):
        calls.extend(paths)
        return inspect(project, paths)

    monkeypatch.setattr(module, "inspect_evidence", tracked)
    assert module._assess(project, contract(tasks[0]))["status"] == "reported_complete"
    assert calls == [".sdlc/evidence/raw.txt"]
