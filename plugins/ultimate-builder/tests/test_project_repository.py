"""Real Git invariants for project-local repository isolation."""

from __future__ import annotations

import importlib.util
import os
import subprocess
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[1]


def load_project_repository():
    path = ROOT / "project_repository.py"
    spec = importlib.util.spec_from_file_location(
        "ultimate_builder_project_repository_test", path
    )
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)
    return module


def git(path: Path, *args: str, check: bool = True) -> subprocess.CompletedProcess[str]:
    env = os.environ.copy()
    env.update(
        {
            "GIT_AUTHOR_NAME": "Test",
            "GIT_AUTHOR_EMAIL": "test@example.invalid",
            "GIT_COMMITTER_NAME": "Test",
            "GIT_COMMITTER_EMAIL": "test@example.invalid",
        }
    )
    return subprocess.run(
        ["git", "-C", str(path), *args],
        capture_output=True,
        check=check,
        env=env,
        text=True,
    )


def initialize(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)
    git(path, "init", "-b", "main")


def commit_all(path: Path, message: str) -> None:
    git(path, "add", "-A")
    git(path, "commit", "--no-gpg-sign", "-m", message)


def test_managed_project_commits_never_change_lyra_repository(tmp_path):
    module = load_project_repository()
    checkout = tmp_path / "lyra"
    initialize(checkout)
    (checkout / ".gitignore").write_text("my_projects/\n", encoding="utf-8")
    (checkout / "README.md").write_text("Lyra\n", encoding="utf-8")
    commit_all(checkout, "Lyra baseline")
    parent_head = git(checkout, "rev-parse", "HEAD").stdout.strip()

    project = checkout / "my_projects" / "private-app"
    project.mkdir(parents=True)
    (project / "app.txt").write_text("private project\n", encoding="utf-8")
    result = module.ensure_project_repository(
        project,
        lyra_checkout=checkout,
        managed_roots=(checkout / "my_projects",),
    )

    assert result["root"] == str(project.resolve())
    assert result["initialized"] is True
    assert result["baseline_created"] is True
    assert result["has_remote"] is False
    assert git(project, "show", "--format=", "--name-only", "HEAD").stdout.strip() == module.PROJECT_MARKER
    assert "?? app.txt" in git(project, "status", "--short").stdout

    commit_all(project, "Save project")
    assert git(checkout, "rev-parse", "HEAD").stdout.strip() == parent_head
    assert git(checkout, "status", "--porcelain=v1").stdout == ""
    assert git(checkout, "ls-files", "--", "my_projects").stdout == ""


def test_existing_project_user_changes_are_not_swept_into_marker_commit(tmp_path):
    module = load_project_repository()
    project = tmp_path / "existing"
    initialize(project)
    (project / "staged.txt").write_text("before\n", encoding="utf-8")
    (project / "unstaged.txt").write_text("before\n", encoding="utf-8")
    commit_all(project, "Existing baseline")
    (project / "staged.txt").write_text("staged user work\n", encoding="utf-8")
    git(project, "add", "staged.txt")
    (project / "unstaged.txt").write_text("unstaged user work\n", encoding="utf-8")
    (project / "untracked.txt").write_text("untracked user work\n", encoding="utf-8")

    result = module.ensure_project_repository(
        project,
        lyra_checkout=tmp_path / "unrelated-lyra",
        managed_roots=(),
    )

    assert result["initialized"] is False
    assert result["baseline_created"] is True
    assert git(project, "diff", "--cached", "--name-only").stdout.strip() == "staged.txt"
    status = git(project, "status", "--short").stdout
    assert "M  staged.txt" in status
    assert " M unstaged.txt" in status
    assert "?? untracked.txt" in status
    assert git(project, "show", "--format=", "--name-only", "HEAD").stdout.strip() == module.PROJECT_MARKER


def test_tracked_legacy_project_is_rejected_without_parent_mutation(tmp_path):
    module = load_project_repository()
    checkout = tmp_path / "lyra"
    initialize(checkout)
    (checkout / ".gitignore").write_text("my_projects/\n", encoding="utf-8")
    project = checkout / "my_projects" / "legacy"
    project.mkdir(parents=True)
    (project / "requirements.md").write_text("private\n", encoding="utf-8")
    git(checkout, "add", ".gitignore")
    git(checkout, "add", "-f", "my_projects/legacy/requirements.md")
    git(checkout, "commit", "--no-gpg-sign", "-m", "Legacy project mistake")
    parent_head = git(checkout, "rev-parse", "HEAD").stdout.strip()
    parent_status = git(checkout, "status", "--porcelain=v1").stdout

    with pytest.raises(module.ProjectRepositoryError, match="older Lyra Git history"):
        module.ensure_project_repository(
            project,
            lyra_checkout=checkout,
            managed_roots=(checkout / "my_projects",),
        )

    assert not (project / ".git").exists()
    assert not (project / module.PROJECT_MARKER).exists()
    assert git(checkout, "rev-parse", "HEAD").stdout.strip() == parent_head
    assert git(checkout, "status", "--porcelain=v1").stdout == parent_status


def test_parent_tracked_nested_repository_is_also_rejected(tmp_path):
    module = load_project_repository()
    checkout = tmp_path / "lyra"
    initialize(checkout)
    (checkout / ".gitignore").write_text("my_projects/\n", encoding="utf-8")
    git(checkout, "add", ".gitignore")
    git(checkout, "commit", "--no-gpg-sign", "-m", "Lyra baseline")

    project = checkout / "my_projects" / "legacy"
    initialize(project)
    (project / "app.txt").write_text("private\n", encoding="utf-8")
    commit_all(project, "Project baseline")
    git(checkout, "add", "-f", "my_projects/legacy")
    git(checkout, "commit", "--no-gpg-sign", "-m", "Legacy project link")
    parent_head = git(checkout, "rev-parse", "HEAD").stdout.strip()

    with pytest.raises(module.ProjectRepositoryError, match="older Lyra Git history"):
        module.ensure_project_repository(
            project,
            lyra_checkout=checkout,
            managed_roots=(checkout / "my_projects",),
        )

    assert git(checkout, "rev-parse", "HEAD").stdout.strip() == parent_head
    assert git(checkout, "status", "--porcelain=v1").stdout == ""


def test_packaged_checkout_without_git_still_prepares_projects(tmp_path):
    module = load_project_repository()
    checkout = tmp_path / "installed-lyra"
    project = checkout / "my_projects" / "private-app"
    project.mkdir(parents=True)

    result = module.ensure_project_repository(
        project,
        lyra_checkout=checkout,
        managed_roots=(checkout / "my_projects",),
    )

    assert result["root"] == str(project.resolve())
    assert result["baseline_created"] is True
    assert result["has_remote"] is False


def test_subfolder_of_unrelated_repository_is_rejected(tmp_path):
    module = load_project_repository()
    parent = tmp_path / "other-repository"
    initialize(parent)
    (parent / "README.md").write_text("Other\n", encoding="utf-8")
    commit_all(parent, "Other baseline")
    project = parent / "packages" / "one"
    project.mkdir(parents=True)

    with pytest.raises(module.ProjectRepositoryError, match="top-level folder"):
        module.ensure_project_repository(
            project,
            lyra_checkout=tmp_path / "lyra",
            managed_roots=(),
        )

    assert not (project / ".git").exists()
