"""Lyra is its own product: its own version, and no upstream pull path.

Two failures this guards against, both quiet:

1. The dashboard showing `hermes_cli.__version__` — the version of the CLI Lyra
   is built on — so "which version are you running?" has no answer a user can
   give and no release note to match.
2. `hermes update` offering, with *yes* as the default on a bare Enter, to add
   NousResearch/hermes-agent as an `upstream` remote and merge its main branch
   into this checkout. Lyra has diverged far past the point where that is safe.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[2]


@pytest.fixture(scope="module")
def version_module():
    import lyra_version

    return lyra_version


def test_lyra_has_its_own_version(version_module):
    assert re.fullmatch(r"\d+\.\d+\.\d+", version_module.LYRA_VERSION)
    assert version_module.LYRA_CHANNEL in {"alpha", "beta", "rc", "stable"}
    assert version_module.LYRA_RELEASE_NAME.strip()


def test_the_display_string_is_what_the_user_should_read(version_module):
    number = version_module.LYRA_VERSION
    if number.endswith(".0"):
        number = number[:-2]
    assert version_module.lyra_version_display() == f"{version_module.LYRA_CHANNEL} v{number}"


def test_the_changelog_top_entry_matches_the_code(version_module):
    """A version bumped in one place and not the other ships a lie."""
    text = (REPO / "CHANGELOG.md").read_text(encoding="utf-8")
    headings = re.findall(r"^##\s*\[([^\]]+)\]", text, re.M)
    versions = [h for h in headings if h.lower() != "unreleased"]
    assert versions, "no released version in the changelog"
    assert versions[0] == version_module.LYRA_VERSION


def test_the_changelog_entry_is_readable(version_module):
    entry = version_module.changelog_entry()
    assert entry is not None
    assert entry["released"]
    assert entry["notes"], "a release with no notes teaches nobody anything"
    # Wrapped bullets are joined, not cut at the first newline.
    assert all(len(note) > 20 for note in entry["notes"])


def test_update_status_never_raises_and_always_answers(version_module):
    status = version_module.update_status(force=True)
    assert set(status) == {"behind", "update_available", "branch", "checked"}
    if status["checked"]:
        assert isinstance(status["behind"], int)
        assert status["update_available"] == (status["behind"] > 0)
    else:
        # Unknown is reported as unknown, never as "up to date".
        assert status["behind"] is None
        assert status["update_available"] is False


def test_the_payload_carries_everything_the_ui_needs(version_module):
    payload = version_module.version_payload()
    for field in ("version", "channel", "display", "release_name", "released", "notes", "update"):
        assert field in payload


def test_update_never_pulls_from_the_upstream_hermes_repo():
    """The dangerous default: Enter meant yes, and yes meant merging upstream."""
    source = (REPO / "hermes_cli" / "main.py").read_text(encoding="utf-8")
    start = source.index("def _sync_with_upstream_if_needed")
    end = source.index("\ndef ", start + 10)
    body = source[start:end]

    assert "return" in body
    for forbidden in ("remote", "add", "pull", "merge", "input("):
        assert forbidden not in body.split('"""')[-1], (
            f"upstream sync still does something with {forbidden!r}"
        )


def test_the_sidebar_shows_lyra_not_the_cli():
    footer = (REPO / "web" / "src" / "components" / "SidebarFooter.tsx").read_text(
        encoding="utf-8"
    )
    assert "getLyraVersion" in footer
    assert "status?.version" not in footer, "the CLI version is back in the footer"


def test_app_builder_version_labels_match_lyra(version_module):
    expected = f"v{version_module.LYRA_VERSION} {version_module.LYRA_CHANNEL}"
    for relative_path in (
        "plugins/ultimate-builder/dashboard/app/index.js",
        "plugins/ultimate-builder/dashboard/dist/index.js",
    ):
        assert expected in (REPO / relative_path).read_text(encoding="utf-8")
