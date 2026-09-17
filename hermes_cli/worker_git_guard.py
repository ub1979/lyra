"""Worker-scoped Git hooks: preserve branch ancestry without editing repositories.

This prevents accidents, not hostile code: workers with shell access can override
Git configuration. Never describe this mechanism as a security sandbox.
"""

from __future__ import annotations

import os
from pathlib import Path
import shlex
import subprocess
import sys
import tempfile


# Forward the complete documented hook surface, resolving each repository's own
# hooks at invocation time (workers may use multiple repositories/worktrees).
HOOKS = (
    "applypatch-msg pre-applypatch post-applypatch pre-commit pre-merge-commit "
    "prepare-commit-msg commit-msg post-commit pre-rebase post-checkout "
    "post-merge pre-push pre-receive update proc-receive post-receive post-update "
    "reference-transaction push-to-checkout pre-auto-gc post-rewrite "
    "sendemail-validate fsmonitor-watchman p4-changelist p4-prepare-changelist "
    "p4-post-changelist p4-pre-submit post-index-change"
).split()


def guarded_worker_env(env: dict[str, str], log_dir: Path) -> dict[str, str]:
    """Append a per-process overlay; leave the caller and repository untouched."""
    result = dict(env)
    index = int(result.get("GIT_CONFIG_COUNT", "0"))
    if index < 0:
        raise ValueError("Invalid inherited Git configuration count")
    directory = Path(tempfile.mkdtemp(prefix="git-hooks-", dir=log_dir))
    runner = Path(__file__).resolve()
    for name in HOOKS:
        hook = directory / name
        command = " ".join(shlex.quote(part) for part in (
            sys.executable, str(runner), str(index), name,
        ))
        hook.write_text(f'#!/bin/sh\nexec {command} "$@"\n', encoding="utf-8")
        hook.chmod(0o700)
    result[f"GIT_CONFIG_KEY_{index}"] = "core.hooksPath"
    result[f"GIT_CONFIG_VALUE_{index}"] = str(directory)
    result["GIT_CONFIG_COUNT"] = str(index + 1)
    return result


def _validate_updates(data: bytes) -> None:
    for line in data.decode("utf-8").splitlines():
        old, new, ref = line.split()
        # Git also reports loose-ref pruning during pack-refs as deletion.
        # This hook cannot safely distinguish that from intentional deletion;
        # enforce ancestry for replacements, not a blanket deletion policy.
        if not ref.startswith("refs/heads/") or set(new) == {"0"}:
            continue
        if set(old) == {"0"}:
            # update-ref without an expected-old argument supplies zeros even
            # for an existing branch. Read it while the transaction holds locks.
            current = subprocess.run(
                ["git", "rev-parse", "--verify", "--quiet", ref],
                capture_output=True, text=True, timeout=15, check=False,
            )
            if current.returncode == 1:
                continue
            if current.returncode != 0:
                raise ValueError(f"cannot inspect existing branch {ref}")
            old = current.stdout.strip()
        # The prepared hook runs while refs are locked. Validate the exact old
        # and proposed object IDs supplied by Git, never a racy read of HEAD.
        check = subprocess.run(
            ["git", "merge-base", "--is-ancestor", old, new],
            capture_output=True, timeout=15, check=False,
        )
        if check.returncode != 0:
            raise ValueError(f"worker cannot rewrite history of {ref}; keep the existing parent")


def run_hook(index: int, name: str, args: list[str]) -> int:
    data = sys.stdin.buffer.read() if name == "reference-transaction" else None
    if name == "reference-transaction" and args == ["prepared"]:
        _validate_updates(data)
    # Remove only our overlay for discovery. The original hook itself retains
    # protection, including Git commands it launches. Do not alter global state.
    discovery = dict(os.environ)
    discovery.pop(f"GIT_CONFIG_KEY_{index}", None)
    discovery.pop(f"GIT_CONFIG_VALUE_{index}", None)
    discovery["GIT_CONFIG_COUNT"] = str(index)
    path = subprocess.run(
        ["git", "rev-parse", "--path-format=absolute", "--git-path", f"hooks/{name}"],
        env=discovery, capture_output=True, text=True, check=True, timeout=15,
    ).stdout.strip()
    original = Path(path)
    if original.is_file() and os.access(original, os.X_OK):
        # Git runs script hooks through its shell, including on Windows where
        # CreateProcess cannot execute a shebang file directly. Keep arguments
        # positional, never interpolate them into shell source.
        return subprocess.run(
            ["sh", "-c", 'exec "$0" "$@"', str(original), *args],
            input=data, check=False,
        ).returncode
    return 0


def preserve_worker_guard(source: dict[str, str], child: dict[str, str]) -> None:
    """Carry only the non-secret guard through execute_code's credential scrub.

    Preserve its slot number for original-hook discovery, but never restore
    unrelated Git values (which may contain HTTP credentials).
    """
    count = int(source.get("GIT_CONFIG_COUNT", "0"))
    if count and source.get(f"GIT_CONFIG_KEY_{count - 1}") == "core.hooksPath":
        path = source.get(f"GIT_CONFIG_VALUE_{count - 1}", "")
        if Path(path).name.startswith("git-hooks-"):
            child["GIT_CONFIG_COUNT"] = str(count)
            for slot in range(count - 1):
                child[f"GIT_CONFIG_KEY_{slot}"] = "lyra.scrubbed"
                child[f"GIT_CONFIG_VALUE_{slot}"] = "true"
            child[f"GIT_CONFIG_KEY_{count - 1}"] = "core.hooksPath"
            child[f"GIT_CONFIG_VALUE_{count - 1}"] = path


if __name__ == "__main__":
    try:
        sys.exit(run_hook(int(sys.argv[1]), sys.argv[2], sys.argv[3:]))
    except (OSError, ValueError, subprocess.SubprocessError) as exc:
        print(f"Lyra worker Git guard: {exc}", file=sys.stderr)
        sys.exit(1)
