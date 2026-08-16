"""Every relative reference link inside a SKILL.md must resolve on disk.

Skill bodies routinely point at companion files ("Read
``references/comment-style.md`` (in this skill's directory)"). Those pointers
are instructions the model is told to follow, so a dangling one silently drops
a mandatory step rather than failing loudly. ``tools/skills_guard.py`` checks
structure and size but not link targets, and nothing walks the bundled trees in
CI, so this test closes that gap.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent

SKILL_TREES = ("skills", "optional-skills", "plugins")

# Matches the relative companion-file links the playbooks actually use, e.g.
# ``references/site-research.md`` or ``oop-restructurer/references/api.md``.
LINK_RE = re.compile(r"(?<![\w./-])((?:[\w.-]+/)*references/[\w.-]+\.md)")


def _skill_files() -> list[Path]:
    found: list[Path] = []
    for tree in SKILL_TREES:
        base = REPO_ROOT / tree
        if base.exists():
            found.extend(sorted(base.rglob("SKILL.md")))
    return found


def _resolve(link: str, skill_md: Path) -> bool:
    """True when *link* resolves relative to the skill dir or one of its parents.

    Cross-skill links such as ``oop-restructurer/references/comment-style.md``
    are written relative to the shared workflows directory, so walk upward a few
    levels before giving up.
    """
    start = skill_md.parent
    for base in (start, *list(start.parents)[:3]):
        if (base / link).is_file():
            return True
    return False


@pytest.mark.parametrize(
    "skill_md", _skill_files(), ids=lambda p: str(p.relative_to(REPO_ROOT))
)
def test_reference_links_resolve(skill_md: Path) -> None:
    text = skill_md.read_text(encoding="utf-8", errors="replace")
    broken = sorted(
        {link for link in LINK_RE.findall(text) if not _resolve(link, skill_md)}
    )
    assert not broken, (
        f"{skill_md.relative_to(REPO_ROOT)} points at reference files that do "
        f"not exist: {broken}"
    )


def test_suite_actually_scans_skills() -> None:
    """Guard against the parametrization silently collapsing to zero cases."""
    assert len(_skill_files()) > 50
