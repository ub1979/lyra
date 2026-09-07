"""Filesystem contracts for the compact project-status projection."""

import importlib.util
import json
from pathlib import Path


def status_module():
    path = Path(__file__).resolve().parents[1] / "project_status.py"
    spec = importlib.util.spec_from_file_location("project_status_test", path)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)
    return module


def parser(markdown: str):
    state = "done" if "Complete" in markdown else "pending"
    return {
        "available": bool(markdown),
        "phases": [
            {
                "id": "researcher",
                "label": "Research",
                "status": "Complete" if state == "done" else "Pending",
                "state": state,
                "evidence": "research-report.md",
            }
        ]
        if markdown
        else [],
    }


def test_snapshot_is_atomic_compact_and_reused_until_ledger_changes(tmp_path):
    module = status_module()
    project = tmp_path / "project"
    sdlc = project / ".sdlc"
    sdlc.mkdir(parents=True)
    progress = sdlc / "progress.md"
    progress.write_text("Complete\n", encoding="utf-8")

    first = module.load_project_status(project, parser)
    status_path = sdlc / "status.json"
    saved = json.loads(status_path.read_text(encoding="utf-8"))
    assert first["cache"] == "refreshed"
    assert saved["summary"] == {"done": 1, "open": 0, "blocked": 0, "active": 0}
    assert saved["updated_at"]
    assert status_path.stat().st_size < 2_000

    assert module.load_project_status(project, parser)["cache"] == "hit"
    progress.write_text("Pending and expanded\n", encoding="utf-8")
    refreshed = module.load_project_status(project, parser)
    assert refreshed["cache"] == "refreshed"
    assert refreshed["phases"][0]["state"] == "pending"


def test_malformed_or_oversized_snapshot_cannot_claim_completion(tmp_path):
    module = status_module()
    sdlc = tmp_path / ".sdlc"
    sdlc.mkdir()
    (sdlc / "progress.md").write_text("Pending\n", encoding="utf-8")
    (sdlc / "status.json").write_text(
        json.dumps({"schema_version": 1, "phases": [{"state": "done"}]}),
        encoding="utf-8",
    )

    result = module.load_project_status(tmp_path, parser)

    assert result["cache"] == "refreshed"
    assert result["phases"][0]["state"] == "pending"


def test_cached_derived_summary_is_recomputed_instead_of_trusted(tmp_path):
    module = status_module()
    sdlc = tmp_path / ".sdlc"
    sdlc.mkdir()
    (sdlc / "progress.md").write_text("Pending\n", encoding="utf-8")
    current = module.load_project_status(tmp_path, parser)
    path = sdlc / "status.json"
    tampered = json.loads(path.read_text(encoding="utf-8"))
    tampered["available"] = True
    tampered["summary"] = {"done": 99, "open": 0, "blocked": 0, "active": 0}
    path.write_text(json.dumps(tampered), encoding="utf-8")

    reread = module.load_project_status(tmp_path, parser)

    assert reread["cache"] == "hit"
    assert reread["summary"]["done"] == 0
    assert reread["summary"]["open"] == 1
    assert reread["source_signature"] == current["source_signature"]


def test_status_symlink_is_replaced_without_writing_outside_project(tmp_path):
    module = status_module()
    project = tmp_path / "project"
    sdlc = project / ".sdlc"
    sdlc.mkdir(parents=True)
    (sdlc / "progress.md").write_text("Complete\n", encoding="utf-8")
    outside = tmp_path / "outside.json"
    outside.write_text('{"private": true}\n', encoding="utf-8")
    (sdlc / "status.json").symlink_to(outside)

    result = module.load_project_status(project, parser)

    assert result["cache"] == "refreshed"
    assert outside.read_text(encoding="utf-8") == '{"private": true}\n'
    assert not (sdlc / "status.json").is_symlink()


def test_sdlc_symlink_never_persists_outside_the_project(tmp_path):
    module = status_module()
    project = tmp_path / "project"
    outside = tmp_path / "outside"
    project.mkdir()
    outside.mkdir()
    (outside / "progress.md").write_text("Complete\n", encoding="utf-8")
    (project / ".sdlc").symlink_to(outside, target_is_directory=True)

    result = module.load_project_status(project, parser)

    assert result["cache"] == "memory"
    assert result["available"] is False
    assert not (outside / "status.json").exists()
