"""Verified, bounded project memory for Lyra Studio builds."""

from __future__ import annotations

import os
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


BRAIN_RELATIVE_PATH = Path(".sdlc/project-brain.md")
MAX_BRAIN_BYTES = 16 * 1024
SOURCE_CANDIDATES = (
    "requirements.md",
    "design-brief.md",
    "plan.md",
    "task-graph.md",
    "project-plan.md",
    ".sdlc/progress.md",
    "review-report.md",
    "bug-report.md",
    "security-report.md",
    "README.md",
)


def _project(path: str | Path) -> Path:
    project = Path(path).expanduser().resolve(strict=False)
    if not project.is_dir():
        raise ValueError(f"Project directory does not exist: {project}")
    return project


def _git(project: Path, *args: str) -> str:
    env = os.environ.copy()
    env["GIT_CONFIG_NOSYSTEM"] = "1"
    try:
        completed = subprocess.run(
            ["git", "-C", str(project), *args],
            capture_output=True,
            check=False,
            env=env,
            text=True,
            timeout=8,
        )
    except (OSError, subprocess.SubprocessError):
        return ""
    return completed.stdout.strip() if completed.returncode == 0 else ""


def _freshness(
    *,
    available: bool,
    oversized: bool,
    current_head: str,
    brain_commit: str,
    dirty: bool,
) -> str:
    if not available:
        return "not_created"
    if oversized:
        return "too_large"
    if dirty:
        return "working_changes"
    if not current_head:
        return "not_committed"
    if brain_commit == current_head:
        return "current"
    return "needs_update"


def project_brain_state(path: str | Path) -> dict[str, Any]:
    """Read project memory and verify its freshness against actual Git state."""
    project = _project(path)
    brain_path = project / BRAIN_RELATIVE_PATH
    available = brain_path.is_file()
    raw = b""
    if available:
        try:
            raw = brain_path.read_bytes()
        except OSError:
            available = False
    oversized = len(raw) > MAX_BRAIN_BYTES
    content = raw[:MAX_BRAIN_BYTES].decode("utf-8", errors="replace")

    current_head = _git(project, "rev-parse", "HEAD")
    brain_commit = _git(
        project,
        "log",
        "-1",
        "--format=%H",
        "--",
        BRAIN_RELATIVE_PATH.as_posix(),
    )
    dirty_lines = _git(project, "status", "--porcelain=v1").splitlines()
    dirty = bool(dirty_lines)
    sources = [name for name in SOURCE_CANDIDATES if (project / name).exists()]

    updated_at = None
    if available:
        try:
            updated_at = datetime.fromtimestamp(
                brain_path.stat().st_mtime,
                tz=timezone.utc,
            ).isoformat()
        except OSError:
            pass

    return {
        "available": available,
        "path": BRAIN_RELATIVE_PATH.as_posix(),
        "content": content,
        "bytes": len(raw),
        "max_bytes": MAX_BRAIN_BYTES,
        "truncated": oversized,
        "freshness": _freshness(
            available=available,
            oversized=oversized,
            current_head=current_head,
            brain_commit=brain_commit,
            dirty=dirty,
        ),
        "updated_at": updated_at,
        "git_head": current_head,
        "brain_commit": brain_commit,
        "working_changes": len(dirty_lines),
        "verified_sources": sources,
    }


PROJECT_BRAIN_CONTRACT = f"""Project Brain contract:
- Read `{BRAIN_RELATIVE_PATH.as_posix()}` before planning or changing this project. If it does not exist, create it before finishing this task.
- Treat it as a retrieval map, not as unquestionable truth. Verify every material claim against the cited project file, current source, tests, and Git history before acting.
- Keep it under {MAX_BRAIN_BYTES // 1024} KB. Preserve durable decisions; replace stale status and next-action text instead of appending a diary of every turn.
- It must contain: product goal and boundaries; architecture map; durable decisions with rationale and evidence paths; current verified state; open risks/questions; next actions; and a compact evidence map.
- Never copy secrets, credentials, personal data, full source files, raw chat transcripts, or lengthy test output into it.
- After verified work, update the brain before the mandatory local commit and stage it in the same commit. Even when no durable decision changed, refresh its verified state and evidence map so Git can prove whether the brain matches the latest project commit.
"""
