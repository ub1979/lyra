"""The readiness line web_server prints is the line every listener parses.

The 2026-07 rebrand renamed the ``HERMES_*_READY`` tokens the backend prints
but left the regexes written as ``HERMES_(?:…)`` untouched, so the desktop
waited forever for a line that never came. This test reads the token from the
Python source and the pattern from each consumer's source, and matches one
against the other — the same file-reading contract style as
``plugins/ultimate-builder/tests/test_plugin.py``.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
WEB_SERVER = ROOT / "hermes_cli" / "web_server.py"

# (file, regex that captures the readiness pattern's source text)
LISTENERS = [
    (
        ROOT / "apps" / "desktop" / "electron" / "backend-ready.ts",
        re.compile(r"_READY_RE = /(.+?)/[a-z]*\n"),
    ),
    (
        ROOT / "apps" / "desktop" / "electron" / "remote-lifecycle.ts",
        re.compile(r"\bREADY_RE = /(.+?)/[a-z]*\n"),
    ),
    (
        ROOT / "apps" / "desktop" / "electron" / "windows-remote-lifecycle.ts",
        re.compile(r"\bREADY_RE = /(.+?)/[a-z]*\n"),
    ),
    (
        ROOT / "scripts" / "iso-certify.py",
        re.compile(r'_READY_RE = re\.compile\(r"(.+?)"\)'),
    ),
]


def printed_tokens() -> set[str]:
    """Every ``*_READY`` literal on the line that chooses the ready token."""
    tokens: set[str] = set()
    for line in WEB_SERVER.read_text(encoding="utf-8").splitlines():
        if "ready_token" in line and "_READY" in line:
            tokens.update(re.findall(r'"([A-Z_]+_READY)"', line))
    return tokens


def listener_pattern(path: Path, finder: re.Pattern[str]) -> re.Pattern[str]:
    match = finder.search(path.read_text(encoding="utf-8"))
    assert match, f"no readiness pattern found in {path.relative_to(ROOT)}"
    # The JavaScript sources use only syntax Python's ``re`` shares
    # (``(?:…)``, ``\d+``, anchors), so the pattern can be compiled as-is.
    return re.compile(match.group(1), re.MULTILINE)


def test_backend_prints_both_headless_and_dashboard_tokens():
    tokens = printed_tokens()
    assert tokens == {"IDRAK_IT_BACKEND_READY", "IDRAK_IT_DASHBOARD_READY"}


@pytest.mark.parametrize("path,finder", LISTENERS, ids=lambda value: getattr(value, "name", ""))
def test_every_listener_matches_the_printed_line(path: Path, finder: re.Pattern[str]):
    pattern = listener_pattern(path, finder)
    for token in sorted(printed_tokens()):
        line = f"{token} port=54321"
        match = pattern.search(line)
        assert match, f"{path.relative_to(ROOT)} does not match {line!r}"
        assert match.group(1) == "54321"


@pytest.mark.parametrize("path,finder", LISTENERS, ids=lambda value: getattr(value, "name", ""))
def test_every_listener_still_accepts_pre_rebrand_backends(path: Path, finder: re.Pattern[str]):
    """A remote install from before the rename must still be adoptable."""
    pattern = listener_pattern(path, finder)
    for legacy in ("HERMES_BACKEND_READY", "HERMES_DASHBOARD_READY"):
        assert pattern.search(f"{legacy} port=1"), f"{path.name} rejects {legacy}"


def test_noise_and_partial_lines_do_not_match():
    pattern = listener_pattern(*LISTENERS[0])
    assert not pattern.search("IDRAK_IT_DASHBOARD_READY po")
    assert not pattern.search("log: IDRAK_IT_DASHBOARD_READY port=1")
