"""Coordinator capability budget without weakening memory or worker tools."""

import json

import pytest

from toolsets import resolve_multiple_toolsets
from tui_gateway.studio_context import studio_toolsets

STUDIO = ["ultimate-builder:app-it"]


def test_default_coordinator_retains_requirements_memory_and_research():
    selected = studio_toolsets(STUDIO, ["coding", "project"])
    tools = set(resolve_multiple_toolsets(selected))
    assert {
        "clarify",
        "read_file",
        "write_file",
        "patch",
        "search_files",
        "terminal",
        "process",
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
    # Retained schemas keep the complete argument/validation contract.
    for item in first:
        name = item["function"]["name"]
        assert (
            item["function"]["parameters"]
            == normal_by_name[name]["function"]["parameters"]
        )
    assert len(json.dumps(first)) < len(json.dumps(normal)) * 0.8
    print(
        f"Schema characters: coding={len(json.dumps(normal))}, coordinator={len(json.dumps(first))}"
    )
