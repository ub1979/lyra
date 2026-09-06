"""Behavioral tests for local commit and push project-privacy guards."""

from __future__ import annotations

import importlib.util
import os
import shutil
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def load_guard():
    path = ROOT / "scripts" / "lyra_git_guard.py"
    spec = importlib.util.spec_from_file_location("lyra_git_guard_test", path)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)
    return module


def git(path: Path, *args: str) -> str:
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
        check=True,
        env=env,
        text=True,
    ).stdout.strip()


def repository(tmp_path: Path) -> Path:
    root = tmp_path / "lyra"
    root.mkdir()
    git(root, "init", "-b", "main")
    (root / "app.txt").write_text("app\n", encoding="utf-8")
    git(root, "add", "app.txt")
    git(root, "commit", "--no-gpg-sign", "-m", "baseline")
    return root


def test_pre_commit_rejects_project_file_and_nested_repository(tmp_path):
    guard = load_guard()
    root = repository(tmp_path)
    project = root / "my_projects" / "private"
    project.mkdir(parents=True)
    (project / "secret.txt").write_text("private\n", encoding="utf-8")
    git(root, "add", "-f", "my_projects/private/secret.txt")
    assert guard.staged_private_paths(root) == ["my_projects/private/secret.txt"]

    git(root, "reset", "--", "my_projects")
    git(project, "init", "-b", "main")
    git(project, "add", "secret.txt")
    git(project, "commit", "--no-gpg-sign", "-m", "project baseline")
    git(root, "add", "-f", "my_projects/private")
    assert guard.staged_private_paths(root) == ["my_projects/private"]


def test_pre_push_rejects_private_history_but_allows_deletion_cleanup(tmp_path):
    guard = load_guard()
    root = repository(tmp_path)
    base = git(root, "rev-parse", "HEAD")
    project = root / "song-maker-studio"
    project.mkdir()
    (project / "song.txt").write_text("private\n", encoding="utf-8")
    git(root, "add", "-f", "song-maker-studio/song.txt")
    git(root, "commit", "--no-gpg-sign", "-m", "private mistake")
    private_commit = git(root, "rev-parse", "HEAD")
    update = f"refs/heads/main {private_commit} refs/heads/main {base}\n"
    assert guard.outgoing_private_paths(root, update) == [
        "song-maker-studio/song.txt"
    ]

    git(root, "rm", "song-maker-studio/song.txt")
    git(root, "commit", "--no-gpg-sign", "-m", "remove private file")
    cleanup = git(root, "rev-parse", "HEAD")
    cleanup_only = f"refs/heads/main {cleanup} refs/heads/main {private_commit}\n"
    assert guard.outgoing_private_paths(root, cleanup_only) == []


def test_real_hooks_block_commit_and_push(tmp_path):
    root = repository(tmp_path)
    shutil.copytree(ROOT / ".githooks", root / ".githooks")
    (root / "scripts").mkdir()
    shutil.copy2(
        ROOT / "scripts" / "lyra_git_guard.py",
        root / "scripts" / "lyra_git_guard.py",
    )
    git(root, "config", "core.hooksPath", ".githooks")

    project = root / "my_projects" / "private"
    project.mkdir(parents=True)
    (project / "secret.txt").write_text("private\n", encoding="utf-8")
    git(root, "add", "-f", "my_projects/private/secret.txt")
    blocked_commit = subprocess.run(
        ["git", "-C", str(root), "commit", "--no-gpg-sign", "-m", "must fail"],
        capture_output=True,
        check=False,
        env=os.environ.copy(),
        text=True,
    )
    assert blocked_commit.returncode != 0
    assert "generated projects are private local work" in blocked_commit.stderr

    git(root, "commit", "--no-verify", "--no-gpg-sign", "-m", "forced mistake")
    remote = tmp_path / "remote.git"
    remote.mkdir()
    git(remote, "init", "--bare")
    git(root, "remote", "add", "origin", str(remote))
    blocked_push = subprocess.run(
        ["git", "-C", str(root), "push", "-u", "origin", "main"],
        capture_output=True,
        check=False,
        env=os.environ.copy(),
        text=True,
    )
    assert blocked_push.returncode != 0
    assert "generated projects are private local work" in blocked_push.stderr
    assert git(remote, "for-each-ref") == ""
