"""Every agent the dashboard offers is wired end to end.

Adding a team member touches five places: the label, description and ETA maps in
ChatPage, the phase order in guided-phase-plan.ts, and a workflow playbook the
orchestrator can load. Miss one and the failure is quiet — an agent with no
playbook is delegated into nothing, an agent missing from the phase order never
gets its turn, and one missing an ETA advertises the coordinator's estimate.

Avatar artwork is reported, not enforced: the UI falls back to an initial, so a
new agent may legitimately ship before its illustration exists.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[2]
CHAT_PAGE = REPO / "web" / "src" / "pages" / "ChatPage.tsx"
PHASE_PLAN = REPO / "web" / "src" / "lib" / "guided-phase-plan.ts"
WORKFLOWS = (
    REPO
    / "plugins"
    / "ultimate-builder"
    / "skills"
    / "ultimate-app-builder"
    / "references"
    / "workflows"
)
AVATARS = REPO / "web" / "public" / "skill-avatars"
BUNDLED_AVATARS = REPO / "hermes_cli" / "web_dist" / "skill-avatars"

# Coordinators, not delivery phases: they are excluded from the picker upstream.
NON_SELECTABLE = {"app-it", "idk_it"}


def _record(name: str) -> dict[str, str]:
    src = CHAT_PAGE.read_text(encoding="utf-8")
    body = re.search(rf"const {name}[^=]*= \{{(.*?)\n\}};", src, re.S)
    assert body, f"{name} not found in ChatPage.tsx"
    return {
        key.strip('"'): value
        for key, value in re.findall(r'^\s*("?[\w-]+"?):\s*(.+?),?\s*$', body.group(1), re.M)
    }


@pytest.fixture(scope="module")
def labels() -> dict[str, str]:
    return _record("GUIDED_SPECIALIST_LABELS")


@pytest.fixture(scope="module")
def selectable(labels) -> list[str]:
    return [k for k in labels if k not in NON_SELECTABLE]


def test_the_picker_offers_more_than_a_handful(selectable):
    assert len(selectable) >= 20, "expected the design and accessibility agents"
    for expected in ("ui-designer", "ux-writer", "a11y-auditor"):
        assert expected in selectable


def test_every_agent_has_a_description_and_an_eta(selectable):
    descriptions = _record("GUIDED_SPECIALIST_DESCRIPTIONS")
    etas = _record("GUIDED_SPECIALIST_ETA_SECONDS")
    missing_desc = [i for i in selectable if i not in descriptions]
    missing_eta = [i for i in selectable if i not in etas]
    assert not missing_desc, f"no card description: {missing_desc}"
    assert not missing_eta, f"no time estimate: {missing_eta}"


def test_every_agent_has_a_slot_in_the_phase_order(selectable):
    order = PHASE_PLAN.read_text(encoding="utf-8")
    listed = re.search(r"GUIDED_PHASE_ORDER[^=]*=\s*\[(.*?)\];", order, re.S)
    assert listed
    ids = re.findall(r'"([\w-]+)"', listed.group(1))
    missing = [i for i in selectable if i not in ids]
    assert not missing, f"missing from GUIDED_PHASE_ORDER: {missing}"
    assert len(ids) == len(set(ids)), "duplicate entries in the phase order"


def test_every_agent_has_a_playbook_to_load(selectable):
    missing = [i for i in selectable if not (WORKFLOWS / i / "SKILL.md").is_file()]
    assert not missing, f"no workflow playbook: {missing}"


def test_playbooks_declare_themselves(selectable):
    for agent in selectable:
        text = (WORKFLOWS / agent / "SKILL.md").read_text(encoding="utf-8")
        assert re.match(r"^---\n", text), f"{agent}: no frontmatter"
        name = re.search(r"^name:\s*(.+)$", text, re.M)
        assert name and name.group(1).strip() == agent, f"{agent}: name mismatch"


def test_avatar_coverage_is_reported(selectable):
    """Not a failure — the UI falls back to an initial — but keep it visible."""
    missing = [
        f"{i.replace('_', '-')}{suffix}.webp"
        for i in selectable
        for suffix in ("", "-sad")
        if not (AVATARS / f"{i.replace('_', '-')}{suffix}.webp").is_file()
    ]
    if missing:
        print("\nagents still awaiting artwork:\n  " + "\n  ".join(missing))


def test_researcher_ships_selected_and_unselected_portraits(selectable):
    assert "researcher" in selectable
    for filename in ("researcher.webp", "researcher-sad.webp"):
        source = AVATARS / filename
        bundled = BUNDLED_AVATARS / filename
        assert source.is_file(), f"missing Researcher portrait: {filename}"
        assert source.stat().st_size > 1_000, f"empty Researcher portrait: {filename}"
        assert bundled.read_bytes() == source.read_bytes(), (
            f"dashboard bundle has a stale Researcher portrait: {filename}"
        )
