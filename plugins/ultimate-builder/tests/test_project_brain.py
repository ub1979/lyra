from __future__ import annotations

import importlib.util
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def load_project_brain():
    path = ROOT / "project_brain.py"
    spec = importlib.util.spec_from_file_location("ultimate_builder_project_brain", path)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)
    return module


def git(project: Path, *args: str) -> str:
    result = subprocess.run(
        [
            "git",
            "-c",
            "user.name=Lyra Test",
            "-c",
            "user.email=lyra@example.invalid",
            "-C",
            str(project),
            *args,
        ],
        capture_output=True,
        check=True,
        text=True,
    )
    return result.stdout.strip()


def make_project(tmp_path: Path) -> Path:
    project = tmp_path / "project"
    project.mkdir()
    git(project, "init")
    (project / "requirements.md").write_text("# Requirements\n", encoding="utf-8")
    brain = project / ".sdlc" / "project-brain.md"
    brain.parent.mkdir()
    brain.write_text(
        "# Project Brain\n\nGoal: [Requirements](requirements.md).\n",
        encoding="utf-8",
    )
    git(project, "add", "requirements.md", ".sdlc/project-brain.md")
    git(project, "commit", "-m", "Initial project memory")
    return project


def test_brain_is_current_when_saved_with_latest_commit(tmp_path):
    module = load_project_brain()
    state = module.project_brain_state(make_project(tmp_path))

    assert state["freshness"] == "current"
    assert state["evidence_status"] == "available"
    assert state["verified_sources"] == ["requirements.md"]


def test_brain_needs_update_after_later_commit(tmp_path):
    module = load_project_brain()
    project = make_project(tmp_path)
    (project / "requirements.md").write_text("Changed\n", encoding="utf-8")
    git(project, "add", "requirements.md")
    git(project, "commit", "-m", "Change requirements")

    assert module.project_brain_state(project)["freshness"] == "needs_update"


def test_brain_reports_working_changes(tmp_path):
    module = load_project_brain()
    project = make_project(tmp_path)
    (project / "requirements.md").write_text("Unsaved\n", encoding="utf-8")

    state = module.project_brain_state(project)
    assert state["freshness"] == "working_changes"
    assert state["working_changes"] == 1


def test_oversized_brain_is_bounded(tmp_path):
    module = load_project_brain()
    project = make_project(tmp_path)
    (project / module.BRAIN_RELATIVE_PATH).write_text(
        "x" * (module.MAX_BRAIN_BYTES + 100), encoding="utf-8"
    )

    state = module.project_brain_state(project)
    assert state["freshness"] == "too_large"
    assert state["truncated"] is True
    assert len(state["content"].encode("utf-8")) <= module.MAX_BRAIN_BYTES


def test_external_evidence_is_never_verified(tmp_path):
    module = load_project_brain()
    project = make_project(tmp_path)
    (project / module.BRAIN_RELATIVE_PATH).write_text(
        "# Brain\n`missing.md` and [outside](../outside.md)", encoding="utf-8"
    )

    state = module.project_brain_state(project)
    assert state["evidence_status"] == "needs_review"
    assert [item["state"] for item in state["evidence"]] == [
        "missing",
        "outside_project",
    ]
