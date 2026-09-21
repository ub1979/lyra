from __future__ import annotations

import importlib.util
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def load_plugin_api():
    path = ROOT / "dashboard" / "plugin_api.py"
    spec = importlib.util.spec_from_file_location("ultimate_builder_plugin_api", path)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)
    return module


def test_workspace_safety_protects_lyra_source_and_allows_project_area(tmp_path):
    module = load_plugin_api()

    checkout = module._workspace_safety(str(module._LYRA_CHECKOUT))
    tracked_child = module._workspace_safety(
        str(module._LYRA_CHECKOUT / "plugins" / "ultimate-builder")
    )
    project = module._workspace_safety(
        str(module._LYRA_CHECKOUT / "my_projects" / "task-manager")
    )
    external = module._workspace_safety(str(tmp_path / "external-project"))

    assert checkout["protected"] is True
    assert tracked_child["protected"] is True
    assert project["allowed"] is True
    assert external["allowed"] is True


def test_workspace_safety_supports_new_nonexistent_projects():
    module = load_plugin_api()
    result = module.workspace_safety(
        str(module._LYRA_CHECKOUT / "my_projects" / "not-created-yet")
    )
    assert result["allowed"] is True
    assert result["path"].endswith("not-created-yet")


def test_project_brain_endpoint_returns_bounded_memory(tmp_path):
    module = load_plugin_api()
    project = tmp_path / "project"
    brain = project / ".sdlc" / "project-brain.md"
    brain.parent.mkdir(parents=True)
    brain.write_text("# Project Brain\n\nGoal: Build useful software.\n", encoding="utf-8")

    state = module.project_brain(str(project))

    assert state["available"] is True
    assert state["path"] == ".sdlc/project-brain.md"
    assert state["content"].startswith("# Project Brain")
    assert state["bytes"] <= state["max_bytes"]
