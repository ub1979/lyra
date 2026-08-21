"""The house engineering standards reach the agents that must enforce them.

`references/engineering-standards.md` is the single source of truth for one unit
per file, a test per unit, the class map and change records. A rule only has
effect if the playbooks point at it: an agent that never reads the file will
happily write a 900-line service with no test and no change record, and nothing
downstream will notice.
"""

from __future__ import annotations

from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[2]
BUILDER = REPO / "plugins" / "ultimate-builder" / "skills" / "ultimate-app-builder"
STANDARDS = BUILDER / "references" / "engineering-standards.md"
WORKFLOWS = BUILDER / "references" / "workflows"


@pytest.fixture(scope="module")
def standards() -> str:
    return STANDARDS.read_text(encoding="utf-8")


def test_the_standards_exist(standards):
    assert len(standards.splitlines()) > 80


@pytest.mark.parametrize(
    "rule",
    [
        "One unit per file",
        "Every unit has a test",
        "class map",
        "Change records",
        "Design patterns",
    ],
)
def test_every_section_is_present(standards, rule):
    assert rule.lower() in standards.lower(), f"missing section: {rule}"


def test_oop_is_a_tool_not_a_ritual(standards):
    """The rule the user asked for is small, testable units — not `class`
    everywhere. Wrapping pure functions in classes is called out explicitly."""
    assert "module" in standards and "component" in standards
    assert "wrap a pure function in a class" in standards


def test_units_are_bounded_and_tested(standards):
    assert "300 lines" in standards
    assert "test file" in standards
    assert "without a test is an incomplete unit" in standards


def test_change_record_is_written_before_the_change(standards):
    assert "written before the change" in standards.lower().replace("**", "")
    for section in ("What changes", "Why", "Blast radius", "Units put back in doubt",
                    "What QA must test", "Rollback"):
        assert section in standards, f"change record template missing: {section}"


@pytest.mark.parametrize("agent", ["sw-developer", "code-reviewer", "sw-architect"])
def test_the_playbooks_point_at_the_standards(agent):
    text = (WORKFLOWS / agent / "SKILL.md").read_text(encoding="utf-8")
    assert "engineering-standards.md" in text, f"{agent} never reads the standards"


def test_the_developer_maintains_both_artifacts():
    text = (WORKFLOWS / "sw-developer" / "SKILL.md").read_text(encoding="utf-8")
    assert "class-map.md" in text
    assert "CR-<n>-<slug>.md" in text
    assert "stale" in text, "touched units must be marked stale"


def test_qa_scopes_regression_from_the_change_record():
    """The gap this closes: QA never saw what a change put at risk."""
    text = (WORKFLOWS / "qa-engineer" / "SKILL.md").read_text(encoding="utf-8")
    assert ".sdlc/changes/" in text
    assert "Units put back in doubt" in text
    assert "class-map.md" in text
    assert "no change record" in text.lower(), "a missing record must be a finding"


def test_review_checks_the_diff_against_the_record():
    text = (WORKFLOWS / "code-reviewer" / "SKILL.md").read_text(encoding="utf-8")
    assert ".sdlc/changes/" in text
    assert "exceeds its record" in text
    assert "without one is a finding" in text


def test_the_architect_writes_the_record_not_just_the_plan():
    text = (WORKFLOWS / "sw-architect" / "SKILL.md").read_text(encoding="utf-8")
    assert ".sdlc/changes/" in text
    assert "not only into `plan.md`" in text


def test_the_umbrella_lists_the_standing_artifacts():
    text = (BUILDER / "SKILL.md").read_text(encoding="utf-8")
    assert ".sdlc/class-map.md" in text
    assert ".sdlc/changes/" in text
