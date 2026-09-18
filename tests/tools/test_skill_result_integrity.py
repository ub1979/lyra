"""Instructional results must survive the same budgets used by real agents."""

import copy
import json
from pathlib import Path

import pytest

from tools.budget_config import BudgetConfig, DEFAULT_BUDGET, budget_for_context_window
from tools.skills_tool import _serve_plugin_skill
from tools.tool_result_storage import enforce_turn_budget, maybe_persist_tool_result
from tui_gateway.studio_budget import coordinator_budget

ROOT = Path(__file__).resolve().parents[2]
WORKFLOWS = ROOT / "plugins/ultimate-builder/skills/ultimate-app-builder/references/workflows"


@pytest.fixture
def instructions(tmp_path, monkeypatch):
    monkeypatch.setenv("HERMES_HOME", str(tmp_path))
    results = []
    for name in ("req-engineer", "sw-developer", "qa-engineer"):
        path = WORKFLOWS / name / "SKILL.md"
        result = _serve_plugin_skill(path, "ultimate-builder", name, preprocess=False)
        decoded = json.loads(result)
        assert decoded["success"]
        assert path.read_text(encoding="utf-8") in decoded["content"]
        results.append(result)
    return results


@pytest.mark.parametrize("budget", [
    DEFAULT_BUDGET,
    coordinator_budget(DEFAULT_BUDGET),
    coordinator_budget(budget_for_context_window(4_000)),
    BudgetConfig(default_result_size=100, turn_budget=200, inline_caps={"skill_view": 50}),
])
def test_real_skills_survive_each_stage_and_combined_batch(instructions, budget):
    history = [{"role": "user", "content": "previous context must stay byte-identical"}]
    before = copy.deepcopy(history)
    messages = []
    for index, result in enumerate(instructions):
        kept = maybe_persist_tool_result(result, "skill_view", f"skill-{index}", config=budget)
        assert kept == result
        messages.append({"role": "tool", "name": "skill_view", "tool_call_id": f"skill-{index}", "content": kept})
    history.extend(messages)
    enforce_turn_budget(messages, config=budget)
    assert [message["content"] for message in messages] == instructions
    assert history[:1] == before


def test_aggregate_preserves_skill_but_still_bounds_ordinary_results(instructions):
    budget = coordinator_budget(DEFAULT_BUDGET)
    messages = [
        {"role": "tool", "tool_name": "skill_view", "tool_call_id": "skill", "content": instructions[0]},
        *[{"role": "tool", "name": "terminal", "tool_call_id": f"t-{i}", "content": "x" * 7_000} for i in range(4)],
    ]
    enforce_turn_budget(messages, config=budget)
    assert messages[0]["content"] == instructions[0]
    assert sum(len(m["content"]) for m in messages[1:]) < 28_000
    huge = "x" * 120_000
    assert len(maybe_persist_tool_result(huge, "terminal", "ordinary", config=budget)) < len(huge)
