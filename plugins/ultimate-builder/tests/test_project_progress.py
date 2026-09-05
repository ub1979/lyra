"""Regression contracts for truthful phase completion and evidence boundaries."""

import importlib.util
from pathlib import Path

import pytest

from hermes_cli.project_evidence import evidence_paths, inspect_evidence


def progress_module():
    spec = importlib.util.spec_from_file_location(
        "progress_test", Path(__file__).resolve().parents[1] / "project_progress.py"
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.mark.parametrize(
    "status",
    [
        "Not complete",
        "Not verified",
        "Not approved",
        "Incomplete",
        "Partially complete",
        "Pending approval",
        "Never verified",
    ],
)
def test_negative_or_partial_report_is_not_done(status):
    assert progress_module()._phase_state(status) != "done"


def test_completed_job_without_evidence_is_not_verified(tmp_path):
    module = progress_module()
    result = module._merge_project_run_state(
        {"phases": []}, {"tasks": [{"phase": "researcher", "status": "done"}]}, tmp_path
    )
    assert result["phases"][0]["state"] == "pending"
    assert "Verified" not in result["phases"][0]["status"]


def test_undispatchable_job_needs_attention_in_the_project_map():
    result = progress_module()._merge_project_run_state({"phases": []}, {"tasks": [{
        "phase": "job:default:custom", "label": "Build planning", "status": "ready",
        "dispatch_issue": "Assigned worker unavailable",
    }]})
    assert result["phases"][0]["label"] == "Build planning"
    assert result["phases"][0]["state"] == "blocked"
    assert result["phases"][0]["status"] == "Waiting for an available worker"


def test_evidence_available_does_not_claim_tests_were_verified(tmp_path):
    module = progress_module()
    (tmp_path / "report.md").write_text("An agent's report")
    ledger = module._parse_progress_ledger(
        "| Phase | Status | Evidence |\n|---|---|---|\n| Research | Complete | `report.md` |"
    )
    checked = module._merge_project_run_state(ledger, {}, tmp_path)["phases"][0]
    assert checked["state"] == "done"
    assert checked["status"] == "Reported complete — evidence available"
    (tmp_path / "report.md").unlink()
    assert (
        module._merge_project_run_state(ledger, {}, tmp_path)["phases"][0]["state"]
        == "pending"
    )


def test_citations_reject_escape_and_symlink_and_fingerprint_contents(tmp_path):
    project = tmp_path / "project"
    project.mkdir()
    outside = tmp_path / "outside.md"
    outside.write_text("Private")
    (project / "link.md").symlink_to(outside)
    source = project / "report.md"
    source.write_text("Report")
    refs = evidence_paths(
        "[Report](report.md) `../outside.md` `link.md` `https://example.com`"
    )
    records = inspect_evidence(project, refs)
    assert [r["state"] for r in records] == [
        "available",
        "outside_project",
        "outside_project",
        "outside_project",
    ]
    source.write_text("Changed report")
    assert inspect_evidence(project, ["report.md"])[0]["sha256"] != records[0]["sha256"]
