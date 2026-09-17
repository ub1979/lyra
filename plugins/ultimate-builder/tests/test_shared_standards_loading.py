"""Specialists' documented shared-reference calls work through Hermes itself."""

import ast
import json
import re

import pytest

from test_plugin import load_plugin


@pytest.mark.parametrize(
    "specialist", ["sw-developer", "sw-architect", "code-reviewer"]
)
def test_documented_standards_call_loads_canonical_file(
    tmp_path, monkeypatch, specialist
):
    from hermes_cli import plugins
    from tools.skills_tool import skill_view

    monkeypatch.setenv("HERMES_HOME", str(tmp_path))
    manager = plugins.PluginManager()
    manager._discovered = True
    monkeypatch.setattr(plugins, "get_plugin_manager", lambda: manager)
    context = plugins.PluginContext(
        plugins.PluginManifest(name="ultimate-builder"), manager
    )
    load_plugin().register(context)

    path = manager.find_plugin_skill(f"ultimate-builder:{specialist}")
    instructions = path.read_text(encoding="utf-8")
    calls = re.findall(
        r"`(skill_view\([^`]*engineering-standards\.md[^`]*\))`", instructions
    )
    assert calls, "Specialist must give an executable reference to the shared standards"
    for source in calls:
        call = ast.parse(source, mode="eval").body
        arguments = {kw.arg: ast.literal_eval(kw.value) for kw in call.keywords}
        result = json.loads(skill_view(**arguments, preprocess=False))
        assert result["success"], result
        canonical = manager.find_plugin_skill("ultimate-builder:ultimate-app-builder")
        expected = (canonical.parent / arguments["file_path"]).read_text(
            encoding="utf-8"
        )
        assert expected in result["content"]

    # The fix must not grant specialists access outside their skill directory.
    denied = json.loads(
        skill_view(
            f"ultimate-builder:{specialist}", file_path="../../engineering-standards.md"
        )
    )
    assert not denied["success"]
