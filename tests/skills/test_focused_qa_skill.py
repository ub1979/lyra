"""Real plugin registration and full QA skill delivery through Hermes."""

from __future__ import annotations

import importlib.util
import json
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[2] / "plugins" / "ultimate-builder"


def load(name):
    spec = importlib.util.spec_from_file_location(f"qa_skill_test_{name}", ROOT / f"{name}.py")
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.fixture
def manager(tmp_path, monkeypatch):
    from hermes_cli import plugins

    monkeypatch.setenv("HERMES_HOME", str(tmp_path / "profile"))
    monkeypatch.setenv("HERMES_KANBAN_HOME", str(tmp_path / "board"))
    manager = plugins.PluginManager()
    load("__init__").register(plugins.PluginContext(
        plugins.PluginManifest(name="ultimate-builder"), manager,
    ))
    # Supply an already registered isolated manager; avoid discovering personal plugins.
    manager._discovered = True
    monkeypatch.setattr(plugins, "_plugin_manager", manager)
    return manager


@pytest.mark.parametrize("profile", ["personal", "reusable", "production"])
def test_queued_skills_are_registered_loaded_whole_and_budget_safe(manager, tmp_path, profile):
    from tools.budget_config import BudgetConfig
    from tools.skills_tool import skill_view
    from tools.tool_result_storage import enforce_turn_budget, maybe_persist_tool_result

    project = tmp_path / "project"
    project.mkdir()
    runs = load("project_runs")
    queued = runs.queue_project_run(project, ["qa-engineer"], build_profile=profile)
    budget = BudgetConfig(default_result_size=100, turn_budget=200)
    with runs.kb.connect_closing() as conn:
        for row in queued["tasks"]:
            task = runs.kb.get_task(conn, row["task_id"])
            messages = []
            originals = []
            for index, name in enumerate(task.skills):
                path = manager.find_plugin_skill(name)
                assert path is not None
                served = skill_view(name=name, preprocess=False)
                result = json.loads(served)
                assert result["success"]
                assert path.read_text(encoding="utf-8") in result["content"]
                originals.append(served)
                kept = maybe_persist_tool_result(served, "skill_view", str(index), config=budget)
                messages.append({"role": "tool", "name": "skill_view", "tool_call_id": str(index), "content": kept})
            enforce_turn_budget(messages, config=budget)
            assert [m["content"] for m in messages] == originals

            # Test the registered, queued and fully delivered instruction contract,
            # not a second copy of prose that bypasses actual worker skill loading.
            shared = json.loads(skill_view(name="ultimate-builder:qa-evidence", preprocess=False))["content"]
            assert "ultimate-builder:qa-evidence" in task.skills
            assert "Before the first interactive browser check" in shared
            assert "Reset state between independent cases" in shared
            assert "Do not" in shared and "every keystroke" in shared
            assert "unselected scope is not a user waiver" in shared
            assert "Run version/diagnostic/report commands separately" in shared
            assert "must never create, invoke or repair raw Chrome DevTools Protocol" in shared
            assert "Raw CDP evidence produced by a QA worker is invalid" in shared
            assert "record that check as **BLOCKED**" in shared
            # Restoring execution advice must not restore conflicting legacy scope.
            assert "Personal QA execution contract" not in task.body


def test_legacy_entry_and_both_complete_references_remain_loadable(manager):
    from tools.skills_tool import skill_view

    name = "ultimate-builder:qa-engineer"
    path = manager.find_plugin_skill(name)
    for relative in (None, "references/legacy-testing.md", "references/legacy-verdict.md"):
        result = json.loads(skill_view(name=name, file_path=relative, preprocess=False))
        assert result["success"]
        expected = (path.parent / relative if relative else path).read_text(encoding="utf-8")
        assert expected in result["content"]


def test_focused_skill_frontmatter_and_linked_references(manager):
    from tools.skills_tool import _parse_frontmatter, skill_view

    for bare in ("qa-evidence", "qa-functional", "qa-experience", "qa-engineer"):
        name = f"ultimate-builder:{bare}"
        path = manager.find_plugin_skill(name)
        document = path.read_text(encoding="utf-8")
        metadata, _ = _parse_frontmatter(document)
        assert metadata["name"] == bare
        assert len(metadata["description"]) <= 60
        assert metadata["description"].endswith(".")
        assert len(document.splitlines()) <= 400
        loaded = json.loads(skill_view(name=name, preprocess=False))
        assert loaded["success"]
