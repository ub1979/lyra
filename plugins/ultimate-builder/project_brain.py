"""Verified, bounded project memory for Lyra builds."""

from __future__ import annotations

import os
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from hermes_cli.project_evidence import evidence_paths, inspect_evidence


BRAIN_RELATIVE_PATH = Path(".sdlc/project-brain.md")
MAX_BRAIN_BYTES = 16 * 1024


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
    *, available: bool, oversized: bool, current_head: str,
    brain_commit: str, dirty: bool,
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
    """Read project memory and compare its freshness with real Git state."""
    project = _project(path)
    brain_path = project / BRAIN_RELATIVE_PATH
    available = brain_path.is_file()
    raw = b""
    if available:
        try:
            if not brain_path.resolve().is_relative_to(project):
                raise OSError("Project Brain must stay inside its project")
            with brain_path.open("rb") as stream:
                raw = stream.read(MAX_BRAIN_BYTES + 1)
        except OSError:
            available = False
    oversized = len(raw) > MAX_BRAIN_BYTES
    bounded = raw[:MAX_BRAIN_BYTES]
    content = bounded.decode("utf-8", errors="ignore")
    while len(content.encode("utf-8")) > MAX_BRAIN_BYTES:
        content = content[:-1]

    current_head = _git(project, "rev-parse", "HEAD")
    brain_commit = _git(
        project, "log", "-1", "--format=%H", "--",
        BRAIN_RELATIVE_PATH.as_posix(),
    )
    dirty_lines = _git(project, "status", "--porcelain=v1").splitlines()
    evidence = inspect_evidence(project, evidence_paths(content))
    sources = [item["path"] for item in evidence if item["state"] == "available"]
    evidence_status = (
        "not_provided" if not evidence else
        "available" if all(item["state"] == "available" for item in evidence) else
        "needs_review"
    )

    updated_at = None
    if available:
        try:
            updated_at = datetime.fromtimestamp(
                brain_path.stat().st_mtime, tz=timezone.utc,
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
            dirty=bool(dirty_lines),
        ),
        "updated_at": updated_at,
        "git_head": current_head,
        "brain_commit": brain_commit,
        "working_changes": len(dirty_lines),
        "verified_sources": sources,
        "evidence": evidence,
        "evidence_status": evidence_status,
        "evidence_note": (
            "File availability and fingerprints are checked; claims and test "
            "outcomes still need review."
        ),
    }


PROJECT_BRAIN_CONTRACT = f"""Project Brain contract:
- Read `{BRAIN_RELATIVE_PATH.as_posix()}` before planning or changing an existing project.
- Treat it as a retrieval map, not as unquestionable truth. Verify material claims against cited files, tests, and Git history.
- Keep it under {MAX_BRAIN_BYTES // 1024} KB. Preserve durable decisions and replace stale status instead of appending a diary.
- Record the product goal and boundaries, architecture map, durable decisions, current verified state, open risks, next actions, and compact evidence paths.
- Never copy secrets, personal data, full source files, raw conversations, or long test output into it.
- Create or refresh it after a meaningful verified milestone, before context compression, or at handoff. Small intermediate actions do not need a rewrite.
"""
