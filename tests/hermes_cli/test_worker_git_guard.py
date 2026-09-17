"""Exercise the actual Git transaction boundary, including Python subprocesses."""

import os
import json
from pathlib import Path
import subprocess
import sys

import pytest

from hermes_cli.worker_git_guard import guarded_worker_env


def git(repo, env, *args, ok=True):
    result = subprocess.run(
        ["git", "-C", str(repo), *args], env=env, text=True,
        capture_output=True, timeout=20,
    )
    if ok:
        assert result.returncode == 0, result.stderr
    return result


@pytest.fixture
def setup(tmp_path):
    env = {key: value for key, value in os.environ.items() if not key.startswith("GIT_")}
    env.update(GIT_CONFIG_NOSYSTEM="1", GIT_CONFIG_GLOBAL=os.devnull,
               GIT_AUTHOR_NAME="Test", GIT_AUTHOR_EMAIL="test@example.invalid",
               GIT_COMMITTER_NAME="Test", GIT_COMMITTER_EMAIL="test@example.invalid")
    repo = tmp_path / "project"
    repo.mkdir()
    git(repo, env, "init", "-b", "main")
    git(repo, env, "commit", "--allow-empty", "-m", "baseline")
    logs = tmp_path / "logs"
    logs.mkdir()
    return repo, env, guarded_worker_env(env, logs)


@pytest.mark.parametrize("scrub", [False, True])
def test_parentless_update_from_python_is_rejected(setup, scrub):
    repo, operator, worker = setup
    before = git(repo, operator, "rev-parse", "HEAD").stdout.strip()
    tree = git(repo, worker, "rev-parse", "HEAD^{tree}").stdout.strip()
    root = git(repo, worker, "commit-tree", tree, "-m", "accidental root").stdout.strip()
    if scrub:
        from tools.code_execution_tool import _scrub_child_env

        worker = _scrub_child_env(worker, is_passthrough=lambda _: False)
    result = subprocess.run(
        [sys.executable, "-c", "import subprocess,sys; sys.exit(subprocess.call(sys.argv[1:]))",
         "git", "update-ref", "refs/heads/main", root],
        cwd=repo, env=worker, capture_output=True, text=True, timeout=20,
    )
    assert result.returncode != 0
    assert "cannot rewrite history" in result.stderr
    assert git(repo, operator, "rev-parse", "HEAD").stdout.strip() == before


@pytest.mark.parametrize("action", ["rewind", "amend"])
def test_existing_branch_history_protected(setup, action):
    repo, operator, worker = setup
    first = git(repo, operator, "rev-parse", "HEAD").stdout.strip()
    git(repo, worker, "commit", "--allow-empty", "-m", "normal worker commit")
    before = git(repo, operator, "rev-parse", "HEAD").stdout
    args = {"rewind": ("update-ref", "refs/heads/main", first),
            "amend": ("commit", "--amend", "--allow-empty", "-m", "replacement")}[action]
    assert git(repo, worker, *args, ok=False).returncode != 0
    assert git(repo, operator, "rev-parse", "HEAD").stdout == before


def test_new_repository_branch_and_operator_config_untouched(setup, tmp_path):
    repo, operator, worker = setup
    assert "GIT_CONFIG_COUNT" not in operator
    assert git(repo, operator, "config", "--get", "core.hooksPath", ok=False).returncode == 1
    git(repo, worker, "checkout", "-b", "feature")
    git(repo, worker, "commit", "--allow-empty", "-m", "feature")
    other = tmp_path / "other"
    other.mkdir()
    git(other, worker, "init", "-b", "main")
    git(other, worker, "commit", "--allow-empty", "-m", "initial")


@pytest.mark.parametrize("hook", ["pre-commit", "reference-transaction"])
def test_existing_custom_hooks_still_reject(setup, tmp_path, hook):
    repo, operator, worker = setup
    hooks = tmp_path / "custom hooks"
    hooks.mkdir()
    original = hooks / hook
    original.write_text("#!/bin/sh\necho original-hook-rejection >&2\nexit 1\n", encoding="utf-8")
    original.chmod(0o700)
    git(repo, operator, "config", "core.hooksPath", str(hooks))
    result = git(repo, worker, "commit", "--allow-empty", "-m", "denied", ok=False)
    assert result.returncode != 0
    assert "original-hook-rejection" in result.stderr
    assert original.read_text(encoding="utf-8").startswith("#!/bin/sh")


def test_inherited_git_configuration_retained(setup, tmp_path):
    repo, operator, _ = setup
    operator.update(GIT_CONFIG_COUNT="1", GIT_CONFIG_KEY_0="user.name", GIT_CONFIG_VALUE_0="Inherited")
    worker = guarded_worker_env(operator, tmp_path)
    assert git(repo, worker, "config", "user.name").stdout.strip() == "Inherited"
    git(repo, worker, "commit", "--allow-empty", "-m", "still works")


def test_scrub_preserves_guard_but_not_git_credentials(setup, tmp_path):
    from tools.code_execution_tool import _scrub_child_env

    repo, operator, _ = setup
    operator.update(GIT_CONFIG_COUNT="1", GIT_CONFIG_KEY_0="http.extraHeader",
                    GIT_CONFIG_VALUE_0="Authorization: private-test-value")
    worker = guarded_worker_env(operator, tmp_path)
    scrubbed = _scrub_child_env(worker, is_passthrough=lambda _: False)
    assert all("private-test-value" not in value for value in scrubbed.values())
    tree = git(repo, operator, "rev-parse", "HEAD^{tree}").stdout.strip()
    root = git(repo, operator, "commit-tree", tree, "-m", "unrelated").stdout.strip()
    assert git(repo, scrubbed, "update-ref", "refs/heads/main", root, ok=False).returncode != 0


def test_stale_parallel_commit_cannot_replace_other_workers_commit(setup):
    repo, operator, worker = setup
    parent = git(repo, operator, "rev-parse", "HEAD").stdout.strip()
    tree = git(repo, operator, "rev-parse", "HEAD^{tree}").stdout.strip()
    candidates = [git(repo, worker, "commit-tree", tree, "-p", parent, "-m", name).stdout.strip()
                  for name in ("first", "second")]
    git(repo, worker, "update-ref", "refs/heads/main", candidates[0])
    assert git(repo, worker, "update-ref", "refs/heads/main", candidates[1], ok=False).returncode != 0
    assert git(repo, operator, "rev-parse", "HEAD").stdout.strip() == candidates[0]


def test_custom_hooks_resolved_for_each_repository(setup, tmp_path):
    repo, operator, worker = setup
    hooks = repo / "custom-hooks"
    hooks.mkdir()
    hook = hooks / "pre-commit"
    hook.write_text("#!/bin/sh\nexit 1\n", encoding="utf-8")
    hook.chmod(0o700)
    git(repo, operator, "config", "core.hooksPath", "custom-hooks")
    assert git(repo, worker, "commit", "--allow-empty", "-m", "rejected", ok=False).returncode != 0
    other = tmp_path / "other-repository"
    other.mkdir()
    git(other, worker, "init", "-b", "main")
    git(other, worker, "commit", "--allow-empty", "-m", "not rejected")


def test_execute_code_real_child_keeps_history_guard(setup, monkeypatch):
    from tools.code_execution_tool import execute_code

    repo, operator, worker = setup
    before = git(repo, operator, "rev-parse", "HEAD").stdout
    tree = git(repo, operator, "rev-parse", "HEAD^{tree}").stdout.strip()
    root = git(repo, operator, "commit-tree", tree, "-m", "unrelated").stdout.strip()
    for key, value in worker.items():
        monkeypatch.setenv(key, value)
    result = json.loads(execute_code(
        code=f"import subprocess\nr = subprocess.run(['git', '-C', {str(repo)!r}, "
             f"'update-ref', 'refs/heads/main', {root!r}], capture_output=True, text=True)\n"
             "print('rejected:', r.returncode != 0)\nprint(r.stderr)",
        task_id="git-guard-integration", enabled_tools=["terminal"],
    ))
    assert result["status"] == "success", result
    assert "rejected: True" in result["output"]
    assert "cannot rewrite history" in result["output"]
    assert git(repo, operator, "rev-parse", "HEAD").stdout == before


def test_transaction_rejection_is_atomic(setup):
    repo, operator, worker = setup
    before = git(repo, operator, "rev-parse", "HEAD").stdout.strip()
    tree = git(repo, operator, "rev-parse", "HEAD^{tree}").stdout.strip()
    root = git(repo, operator, "commit-tree", tree, "-m", "unrelated").stdout.strip()
    result = subprocess.run(
        ["git", "-C", str(repo), "update-ref", "--stdin"],
        env=worker, capture_output=True, text=True, timeout=20,
        input=f"start\ncreate refs/heads/new {before}\nupdate refs/heads/main {root}\nprepare\ncommit\n",
    )
    assert result.returncode != 0
    assert git(repo, operator, "rev-parse", "HEAD").stdout.strip() == before
    assert git(repo, operator, "show-ref", "--verify", "refs/heads/new", ok=False).returncode != 0


def test_packed_refs_do_not_lose_protection(setup):
    repo, operator, worker = setup
    before = git(repo, operator, "rev-parse", "HEAD").stdout
    git(repo, worker, "pack-refs", "--all")
    git(repo, worker, "commit", "--allow-empty", "-m", "after packing")
    assert git(repo, worker, "update-ref", "refs/heads/main", before.strip(), ok=False).returncode != 0
