"""The imported framework and UI/UX skill bundles stay loadable and self-contained.

These skills came from three upstream repos (see the ATTRIBUTION.md in each
bundle) and were trimmed on the way in: `frontend-dev` lost its MiniMax API
scripts and font blob, and the `design-quality` skills had their reference paths
rewritten one level up because they were written for a different repo root.
Both edits are the kind that rot silently — a re-import or a tidy-up would put
back a script that needs an API key nobody has, or leave a `skill_view` pointing
at a file that is not there.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[2]
FRAMEWORKS = REPO / "skills" / "frameworks"
UI_UX = REPO / "skills" / "ui-ux"

FRONTMATTER = re.compile(r"^---\n(.*?)\n---\n", re.S)


def _skills(base: Path) -> list[Path]:
    return sorted(base.rglob("SKILL.md"))


def test_bundles_are_present():
    assert FRAMEWORKS.is_dir() and UI_UX.is_dir()
    names = {p.parent.name for p in _skills(FRAMEWORKS)}
    assert {
        "fullstack-dev",
        "frontend-dev",
        "android-native-dev",
        "ios-application-dev",
        "flutter-dev",
        "react-native-dev",
        "shader-dev",
    } <= names


@pytest.mark.parametrize("skill", _skills(FRAMEWORKS) + _skills(UI_UX), ids=lambda p: p.parent.name)
def test_every_imported_skill_has_usable_frontmatter(skill: Path):
    """A skill without name + description is invisible to the loader."""
    text = skill.read_text(encoding="utf-8")
    match = FRONTMATTER.match(text)
    assert match, f"{skill} has no YAML frontmatter"
    block = match.group(1)
    assert re.search(r"^name:\s*\S", block, re.M), f"{skill} has no name"
    assert re.search(r"^description:", block, re.M), f"{skill} has no description"


def test_imported_skill_names_do_not_collide_with_existing_ones():
    imported: dict[str, Path] = {}
    for skill in _skills(FRAMEWORKS) + _skills(UI_UX):
        name = re.search(r"^name:\s*(.+)$", skill.read_text(encoding="utf-8"), re.M)
        assert name
        imported[name.group(1).strip()] = skill

    for skill in sorted((REPO / "skills").rglob("SKILL.md")):
        if FRAMEWORKS in skill.parents or UI_UX in skill.parents:
            continue
        name = re.search(r"^name:\s*(.+)$", skill.read_text(encoding="utf-8"), re.M)
        if name and name.group(1).strip() in imported:
            pytest.fail(f"{name.group(1).strip()} collides: {skill} vs {imported[name.group(1).strip()]}")


def test_frontend_dev_needs_no_minimax_account():
    """Asset generation was rerouted to Lyra's own tools; the API scripts are gone."""
    root = FRAMEWORKS / "frontend-dev"
    assert not (root / "canvas-fonts").exists(), "the 5.5 MB font blob is back"
    assert not list(root.glob("scripts/minimax_*.py")), "MiniMax API scripts are back"
    skill = (root / "SKILL.md").read_text(encoding="utf-8")
    assert "MINIMAX_API_KEY" not in skill
    assert "image_generate" in skill, "asset generation should route to Lyra's tools"


def test_design_quality_references_resolve_inside_the_bundle():
    """These skills were repo-root relative upstream; every path was rewritten."""
    bundle = UI_UX / "design-quality"
    referenced = 0
    for skill in bundle.glob("*/SKILL.md"):
        text = skill.read_text(encoding="utf-8")
        for ref in re.findall(r"`(\.\./[\w./-]+\.(?:md|json|py|mjs))`", text):
            target = (skill.parent / ref).resolve()
            assert target.exists(), f"{skill.parent.name} points at missing {ref}"
            referenced += 1
        # Nothing may still expect the upstream repo root.
        for stale in re.findall(r"`(?!\.\./)((?:accessibility|taste|tokens|components|scripts)/[\w./-]+)`", text):
            pytest.fail(f"{skill.parent.name} still uses the upstream path {stale}")
    assert referenced >= 5, "expected the skills to cite their reference files"


def test_attribution_survives_the_import():
    for bundle in (FRAMEWORKS, UI_UX):
        attribution = (bundle / "ATTRIBUTION.md").read_text(encoding="utf-8")
        assert "github.com" in attribution
        assert "License" in attribution or "MIT" in attribution
    assert (UI_UX / "LICENSE-taste-skill-MIT.txt").is_file()


def test_categories_describe_themselves():
    for bundle in (FRAMEWORKS, UI_UX):
        text = (bundle / "DESCRIPTION.md").read_text(encoding="utf-8")
        assert re.match(r"^---\n.*?description:.*?\n---", text, re.S), bundle
