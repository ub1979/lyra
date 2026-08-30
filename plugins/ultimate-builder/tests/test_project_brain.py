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
    brain.write_text("# Project Brain\n\nVerified memory.\n", encoding="utf-8")
    git(project, "add", "requirements.md", ".sdlc/project-brain.md")
    git(project, "commit", "-m", "Initial project memory")
    return project


def test_brain_is_current_when_saved_with_latest_project_commit(tmp_path):
    module = load_project_brain()
    project = make_project(tmp_path)

    state = module.project_brain_state(project)

    assert state["available"] is True
    assert state["freshness"] == "current"
    assert state["git_head"] == state["brain_commit"]
    assert state["verified_sources"] == ["requirements.md"]


def test_brain_needs_update_after_later_project_commit(tmp_path):
    module = load_project_brain()
    project = make_project(tmp_path)
    (project / "requirements.md").write_text(
        "# Requirements\n\nA changed goal.\n", encoding="utf-8"
    )
    git(project, "add", "requirements.md")
    git(project, "commit", "-m", "Change product goal")

    state = module.project_brain_state(project)

    assert state["freshness"] == "needs_update"
    assert state["git_head"] != state["brain_commit"]


def test_brain_reports_unsaved_working_changes(tmp_path):
    module = load_project_brain()
    project = make_project(tmp_path)
    (project / "requirements.md").write_text("# Unsaved change\n", encoding="utf-8")

    state = module.project_brain_state(project)

    assert state["freshness"] == "working_changes"
    assert state["working_changes"] == 1


def test_oversized_brain_is_bounded_and_flagged(tmp_path):
    module = load_project_brain()
    project = make_project(tmp_path)
    brain = project / module.BRAIN_RELATIVE_PATH
    brain.write_text("x" * (module.MAX_BRAIN_BYTES + 100), encoding="utf-8")

    state = module.project_brain_state(project)

    assert state["freshness"] == "too_large"
    assert state["truncated"] is True
    assert len(state["content"].encode("utf-8")) <= module.MAX_BRAIN_BYTES


def test_non_git_project_memory_is_visible_but_not_verifiable(tmp_path):
    module = load_project_brain()
    project = tmp_path / "plain-project"
    brain = project / ".sdlc" / "project-brain.md"
    brain.parent.mkdir(parents=True)
    brain.write_text("# Project Brain\n", encoding="utf-8")

    state = module.project_brain_state(project)

    assert state["available"] is True
    assert state["freshness"] == "not_committed"
