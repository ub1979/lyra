"""Coordinator capability budget without weakening memory or worker tools."""

import json

import pytest

from toolsets import resolve_multiple_toolsets
from tui_gateway.studio_context import studio_disabled_toolsets, studio_toolsets

STUDIO = ["ultimate-builder:app-it"]


@pytest.mark.parametrize("configured", [["coding", "project"], ["debugging", "memory"], None])
def test_explicit_bundles_cannot_restore_worker_execution(configured):
    from model_tools import get_tool_definitions

    selected = studio_toolsets(STUDIO, configured, explicit=True)
    names = {
        item["function"]["name"] for item in get_tool_definitions(
            selected, disabled_toolsets=studio_disabled_toolsets(STUDIO), quiet_mode=True,
        )
    }
    assert not {"terminal", "process", "execute_code", "delegate_task"} & names
    assert {"memory", "read_file", "write_file", "patch"} <= names
    assert studio_disabled_toolsets(["ultimate-builder:ultimate-app-builder"]) is None


def test_gateway_applies_role_exclusions_at_construction(tmp_path, monkeypatch):
    from unittest.mock import MagicMock, patch
    from tui_gateway import server

    monkeypatch.setenv("HERMES_HOME", str(tmp_path))
    monkeypatch.setenv("HERMES_TUI_TOOLSETS", "coding,project")
    with (
        patch.object(server, "_load_cfg", return_value={}),
        patch.object(server, "_get_db", return_value=MagicMock()),
        patch.object(server, "_load_enabled_toolsets", return_value=["coding", "project"]),
        patch.object(server, "_resolve_startup_runtime", return_value=("mock", "custom")),
        patch("hermes_cli.runtime_provider.resolve_runtime_provider", return_value={
            "provider": "custom", "base_url": "http://127.0.0.1:1/v1", "api_key": "test",
        }),
        patch("agent.skill_commands.build_preloaded_skills_prompt", return_value=("guide", STUDIO, [])),
        patch("run_agent.AIAgent") as constructor,
    ):
        server._make_agent("isolated", "isolated", skills_override=STUDIO)
    assert constructor.call_args.kwargs["disabled_toolsets"] == studio_disabled_toolsets(STUDIO)
    assert constructor.call_args.kwargs["enabled_toolsets"] == ["coding", "project"]


def test_default_coordinator_retains_requirements_memory_and_research():
    selected = studio_toolsets(STUDIO, ["coding", "project"])
    tools = set(resolve_multiple_toolsets(selected))
    assert {
        "clarify",
        "read_file",
        "write_file",
        "patch",
        "search_files",
        "skill_view",
        "skills_list",
        "memory",
        "session_search",
        "web_search",
        "web_extract",
        "browser_navigate",
        "browser_snapshot",
        "vision_analyze",
        "project_list",
    } <= tools
    assert (
        not {
            "delegate_task",
            "execute_code",
            "skill_manage",
            "project_switch",
            "project_create",
        }
        & tools
    )
    assert tools < set(resolve_multiple_toolsets(["coding", "project"]))


def test_coordinator_has_no_shell():
    """Dispatch runs through the project_run tool; a shell would let it do specialist work."""
    tools = set(resolve_multiple_toolsets(studio_toolsets(STUDIO, ["coding", "project"])))
    assert not {"terminal", "process", "read_terminal", "close_terminal"} & tools


def test_project_run_tool_joins_the_guide_bundle_through_the_registry():
    import importlib.util
    from pathlib import Path

    from tools.registry import registry

    path = Path(__file__).resolve().parents[2] / "plugins/ultimate-builder/project_run_tool.py"
    spec = importlib.util.spec_from_file_location("studio_context_project_run_tool", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)

    class Ctx:
        def register_tool(self, **kwargs):
            if "project_run" not in registry.get_tool_names_for_toolset("project-guide"):
                registry.register(**kwargs)

    module.register_project_run_tool(Ctx())

    assert "project_run" in set(resolve_multiple_toolsets(["project-guide"]))
    assert "project_run" not in set(resolve_multiple_toolsets(["coding"]))


@pytest.mark.parametrize(
    "skills,explicit",
    [([], False), (["ultimate-builder:ultimate-app-builder"], False), (STUDIO, True)],
)
def test_other_agents_and_explicit_choices_are_untouched(skills, explicit):
    configured = ["coding", "project", "mcp_private"]
    assert studio_toolsets(skills, configured, explicit=explicit) is configured


@pytest.mark.parametrize("configured", [None, [], ["file", "memory"], ["all"]])
def test_nondefault_configuration_is_untouched(configured):
    assert studio_toolsets(STUDIO, configured) is configured


def test_custom_capabilities_survive_and_input_is_not_mutated():
    configured = ["coding", "project", "mcp_private", "image_gen"]
    original = list(configured)
    selected = studio_toolsets(STUDIO, configured)
    assert selected == ["project-guide", "mcp_private", "image_gen"]
    assert configured == original
    assert studio_toolsets(STUDIO, selected) == selected


def test_expanded_default_profile_is_lean_but_disabled_memory_stays_disabled():
    configured = [
        "web",
        "browser",
        "file",
        "terminal",
        "vision",
        "memory",
        "session_search",
        "clarify",
        "todo",
        "skills",
        "code_execution",
        "delegation",
        "project",
        "image_gen",
    ]
    assert studio_toolsets(STUDIO, configured) == ["project-guide", "image_gen"]
    configured.remove("memory")
    assert studio_toolsets(STUDIO, configured) is configured


def test_real_schema_resolution_is_smaller_and_repeatable():
    from model_tools import get_tool_definitions

    normal = get_tool_definitions(["coding", "project"], quiet_mode=True)
    selected = studio_toolsets(STUDIO, ["coding", "project"])
    first = get_tool_definitions(selected, quiet_mode=True)
    second = get_tool_definitions(selected, quiet_mode=True)
    assert json.dumps(first) == json.dumps(second)
    normal_by_name = {item["function"]["name"]: item for item in normal}
    # Retained schemas keep the complete argument/validation contract. The
    # coordinator-only dispatch tool is the one schema the coding profile lacks.
    coordinator_only = {item["function"]["name"] for item in first} - set(normal_by_name)
    assert coordinator_only <= {"project_run"}
    for item in first:
        name = item["function"]["name"]
        if name in coordinator_only:
            continue
        assert (
            item["function"]["parameters"]
            == normal_by_name[name]["function"]["parameters"]
        )
    assert len(json.dumps(first)) < len(json.dumps(normal)) * 0.8
    print(
        f"Schema characters: coding={len(json.dumps(normal))}, coordinator={len(json.dumps(first))}"
    )
