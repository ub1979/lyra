"""Lyra's own product version, its changelog, and the update signal.

Distinct from ``hermes_cli.__version__``, which tracks the upstream Hermes CLI
this is built on (0.19.0 at the time of writing). Users install *Lyra*, so the
number they see, report in bugs, and compare against a release note has to be
Lyra's own — conflating the two makes "which version are you on?" unanswerable.

``CHANGELOG.md`` is the human record and this module is the machine one. They are
kept in step by a test rather than by discipline: the top entry of the changelog
must match ``LYRA_VERSION``.
"""

from __future__ import annotations

import re
import subprocess
import time
from pathlib import Path
from typing import Any, Optional

LYRA_VERSION = "0.19.15"
"""Semantic version. Bump with every release; the changelog's top entry must match."""

LYRA_CHANNEL = "beta"
"""alpha → beta → rc → stable. Shown next to the number so nobody mistakes this for finished."""

LYRA_RELEASE_NAME = "unified Studio model experience"
"""Short human name for the release. The line under the number in the UI."""

LYRA_RELEASED = "2026-08-30"

PROJECT_ROOT = Path(__file__).resolve().parent
CHANGELOG_PATH = PROJECT_ROOT / "CHANGELOG.md"

_UPDATE_CACHE_TTL_SECONDS = 3600
_update_cache: dict[str, Any] = {}


def lyra_version_display() -> str:
    """What the user sees: ``beta v0.19.15``.

    The patch digit is dropped when it is zero — a release called
    "alpha v0.17.0" reads like a build number, not a version.
    """
    number = LYRA_VERSION
    if number.endswith(".0"):
        number = number[: -len(".0")]
    return f"{LYRA_CHANNEL} v{number}" if LYRA_CHANNEL else f"v{number}"


def changelog_entry(version: str = LYRA_VERSION) -> Optional[dict[str, Any]]:
    """Return ``{version, released, notes}`` for *version*, or None if absent.

    Parses the Keep-a-Changelog shape this repo uses:
    ``## [0.19.15] - 2026-08-30 — unified Studio model experience``.
    """
    try:
        text = CHANGELOG_PATH.read_text(encoding="utf-8")
    except OSError:
        return None

    heading = re.compile(r"^##\s*\[([^\]]+)\]\s*-\s*(\S+)\s*(?:—\s*(.*))?$", re.M)
    matches = list(heading.finditer(text))
    for index, match in enumerate(matches):
        if match.group(1) != version:
            continue
        end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        body = text[match.end():end]
        # Bullets wrap across lines in a readable changelog; a note cut at the
        # first newline reads as a truncated sentence in the UI.
        notes: list[str] = []
        for line in body.splitlines():
            stripped = line.strip()
            if stripped.startswith(("-", "*")):
                notes.append(stripped.lstrip("-*").strip())
            elif stripped and notes and line.startswith((" ", "\t")):
                notes[-1] = f"{notes[-1]} {stripped}"
        return {
            "version": match.group(1),
            "released": match.group(2),
            "title": (match.group(3) or "").strip(),
            "notes": notes,
        }
    return None


def _git(*args: str, timeout: float = 5.0) -> Optional[str]:
    """Run a read-only git command in the project, or None if it cannot."""
    try:
        result = subprocess.run(
            ["git", *args],
            cwd=str(PROJECT_ROOT),
            capture_output=True,
            text=True,
            timeout=timeout,
        )
    except (OSError, subprocess.SubprocessError):
        return None
    if result.returncode != 0:
        return None
    return result.stdout.strip()


def update_status(force: bool = False) -> dict[str, Any]:
    """How far this checkout is behind its own remote.

    Deliberately *not* the upstream-Hermes update check in web_server, which is
    disabled for this distribution. This answers a narrower question the user
    actually has — "is there a newer Lyra than the one I am running?" — by
    counting commits between HEAD and the tracked remote branch.

    Never raises and never blocks for long: no git, no remote, no network, or a
    detached HEAD all resolve to "unknown", which the UI renders as silence
    rather than as an alarm.
    """
    now = time.monotonic()
    if not force and _update_cache:
        if now - _update_cache.get("at", 0.0) < _UPDATE_CACHE_TTL_SECONDS:
            return dict(_update_cache["value"])

    status: dict[str, Any] = {
        "behind": None,
        "update_available": False,
        "branch": None,
        "checked": False,
    }

    branch = _git("rev-parse", "--abbrev-ref", "HEAD")
    if branch and branch != "HEAD":
        status["branch"] = branch
        upstream = _git("rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}")
        if upstream:
            # Fetch is intentionally omitted: it is slow, needs credentials, and
            # a dashboard that stalls on a network call is worse than one that
            # reports a slightly stale count.
            behind = _git("rev-list", "--count", f"HEAD..{upstream}")
            if behind is not None and behind.isdigit():
                status["behind"] = int(behind)
                status["update_available"] = int(behind) > 0
                status["checked"] = True

    _update_cache["at"] = now
    _update_cache["value"] = dict(status)
    return status


def version_payload(force_update_check: bool = False) -> dict[str, Any]:
    """Everything the dashboard needs to show the version and update state."""
    entry = changelog_entry() or {}
    return {
        "version": LYRA_VERSION,
        "channel": LYRA_CHANNEL,
        "display": lyra_version_display(),
        "release_name": LYRA_RELEASE_NAME,
        "released": entry.get("released", LYRA_RELEASED),
        "title": entry.get("title", LYRA_RELEASE_NAME),
        "notes": entry.get("notes", []),
        "update": update_status(force=force_update_check),
    }
