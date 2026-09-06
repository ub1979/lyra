"""Reject generated project content from Lyra application commits and pushes."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path


PRIVATE_PREFIXES = ("my_projects/", "song-maker-studio/")


def _is_zero_sha(value: str) -> bool:
    """Support both SHA-1 and SHA-256 repositories."""
    return bool(value) and set(value) == {"0"}


def _git(root: Path, *args: str) -> bytes:
    result = subprocess.run(
        ["git", "-C", str(root), *args],
        capture_output=True,
        check=False,
    )
    if result.returncode != 0:
        raise RuntimeError(result.stderr.decode("utf-8", errors="replace").strip())
    return result.stdout


def _paths(output: bytes) -> set[str]:
    return {
        value.decode("utf-8", errors="replace")
        for value in output.split(b"\0")
        if value
    }


def _private(paths: set[str]) -> list[str]:
    return sorted(
        path for path in paths if any(path.startswith(prefix) for prefix in PRIVATE_PREFIXES)
    )


def staged_private_paths(root: Path) -> list[str]:
    output = _git(
        root,
        "diff",
        "--cached",
        "--name-only",
        "--diff-filter=d",
        "-z",
        "--",
    )
    return _private(_paths(output))


def outgoing_private_paths(root: Path, updates: str) -> list[str]:
    """Inspect every outgoing commit; deletion-only cleanup remains allowed."""
    offenders: set[str] = set()
    for line in updates.splitlines():
        fields = line.split()
        if len(fields) != 4:
            continue
        _local_ref, local_sha, _remote_ref, remote_sha = fields
        if _is_zero_sha(local_sha):
            continue
        revision_args = (
            [f"{remote_sha}..{local_sha}"]
            if not _is_zero_sha(remote_sha)
            else [local_sha, "--not", "--remotes"]
        )
        commits = _git(root, "rev-list", *revision_args).decode().splitlines()
        for commit in commits:
            changed = _git(
                root,
                "diff-tree",
                "--root",
                "--no-commit-id",
                "--name-only",
                "--diff-filter=d",
                "-r",
                "-z",
                commit,
                "--",
            )
            offenders.update(_private(_paths(changed)))
    return sorted(offenders)


def _reject(paths: list[str], action: str) -> int:
    if not paths:
        return 0
    sample = "\n".join(f"  - {path}" for path in paths[:20])
    more = f"\n  - …and {len(paths) - 20} more" if len(paths) > 20 else ""
    print(
        f"Lyra stopped this {action}: generated projects are private local work.\n"
        f"{sample}{more}\n"
        "Commit and push from the project's own folder, never from Lyra's repository.",
        file=sys.stderr,
    )
    return 1


def main(argv: list[str] | None = None) -> int:
    args = list(argv if argv is not None else sys.argv[1:])
    if not args or args[0] not in {"pre-commit", "pre-push"}:
        print("Usage: lyra_git_guard.py pre-commit|pre-push", file=sys.stderr)
        return 2
    try:
        root = Path(_git(Path.cwd(), "rev-parse", "--show-toplevel").decode().strip())
        if args[0] == "pre-commit":
            return _reject(staged_private_paths(root), "commit")
        return _reject(outgoing_private_paths(root, sys.stdin.read()), "push")
    except RuntimeError as exc:
        print(f"Lyra could not verify project privacy: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
