"""The plugin's New-project screen agrees with the chat dashboard.

`plugins/ultimate-builder/dashboard/app/index.js` is a hand-written, pre-bundled
file the browser loads directly — it is not generated from web/src, so it holds
a second copy of the agent roster. The legacy `dist/index.js` stays frozen so a
machine where an earlier Lyra session changed it can still update with a plain
`git pull`; the manifest loads `app/index.js` instead.
"""

from __future__ import annotations

import re
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
DASHBOARD = REPO / "plugins" / "ultimate-builder" / "dashboard" / "app" / "index.js"
CHAT_PAGE = REPO / "web" / "src" / "pages" / "ChatPage.tsx"
WORKFLOWS = (
    REPO / "plugins" / "ultimate-builder" / "skills" / "ultimate-app-builder"
    / "references" / "workflows"
)

NON_SELECTABLE = {"app-it", "idk_it"}


def _dashboard_ids() -> list[str]:
    src = DASHBOARD.read_text(encoding="utf-8")
    block = re.search(r"const SKILLS = \[(.*?)\n  \];", src, re.S)
    assert block, "SKILLS array not found in the plugin dashboard"
    return re.findall(r'\[\s*"([\w-]+)"', block.group(1))


def _chat_ids() -> list[str]:
    src = CHAT_PAGE.read_text(encoding="utf-8")
    block = re.search(r"const GUIDED_SPECIALIST_LABELS[^=]*= \{(.*?)\n\};", src, re.S)
    assert block
    ids = re.findall(r'^\s*"?([\w-]+)"?:\s*"', block.group(1), re.M)
    return [i for i in ids if i not in NON_SELECTABLE]


def test_both_screens_offer_the_same_agents():
    assert sorted(_dashboard_ids()) == sorted(_chat_ids())


def test_the_new_agents_reached_the_launcher():
    ids = _dashboard_ids()
    for expected in ("ui-designer", "ux-writer", "a11y-auditor"):
        assert expected in ids, f"{expected} missing from the New project screen"


def test_every_offered_agent_has_a_playbook():
    missing = [i for i in _dashboard_ids() if not (WORKFLOWS / i / "SKILL.md").is_file()]
    assert not missing, f"offered with no playbook to load: {missing}"


def test_requirements_cannot_be_switched_off_at_launch():
    src = DASHBOARD.read_text(encoding="utf-8")
    assert 'REQUIRED_SKILL_IDS = ["req-engineer"]' in src
    # Every path that sets the team funnels through withRequired().
    assert "useState(withRequired([]))" in src
    assert "setSelected(withRequired(template.skills))" in src
    assert "setSelected(withRequired([]))" in src, "Clear must keep requirements"
    assert "if (REQUIRED_SKILL_IDS.indexOf(id) !== -1) return;" in src


def test_the_launcher_speaks_of_agents():
    src = DASHBOARD.read_text(encoding="utf-8")
    assert "agents selected" in src
    assert '" skills")' not in src, "template badge still says skills"
    assert "right specialists" not in src


def test_provider_switch_requires_user_selected_agent_models():
    src = DASHBOARD.read_text(encoding="utf-8")
    assert "unavailableSelectedModels" in src
    assert "Lyra will not guess an equivalent" in src
    assert "Follow project model" in src
    assert "starting || unavailableSelectedModels.length > 0" in src


def test_the_launcher_boot_prompt_matches_the_playbook():
    """It ships its own copy of Lyra's opening instruction."""
    src = DASHBOARD.read_text(encoding="utf-8")
    assert "ultimate-builder:req-engineer" in src, "requirements gate missing"
    assert "requirements.md" in src
    assert "these are AGENTS" in src
