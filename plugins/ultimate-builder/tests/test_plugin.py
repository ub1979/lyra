from __future__ import annotations

import importlib.util
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class Context:
    def __init__(self):
        self.skills = []
        self.commands = []
        self.injected = []

    def register_skill(self, name, path, description=""):
        self.skills.append((name, path, description))

    def register_command(self, name, handler, description="", args_hint=""):
        self.commands.append((name, handler, description, args_hint))

    def inject_message(self, prompt):
        self.injected.append(prompt)
        return True


def load_plugin():
    spec = importlib.util.spec_from_file_location("ultimate_builder", ROOT / "__init__.py")
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)
    return module


def test_registers_skill_and_commands():
    module = load_plugin()
    ctx = Context()
    module.register(ctx)
    skill_names = [row[0] for row in ctx.skills]
    assert skill_names[0] == "ultimate-app-builder"
    assert set(skill_names[1:]) == set(module._SPECIALIST_SKILLS)
    assert len(skill_names) == 19
    assert all(row[1].is_file() for row in ctx.skills)
    assert {row[0] for row in ctx.commands} == {"ultimate-build", "ultimate-status"}


def test_build_command_requires_brief():
    module = load_plugin()
    assert "Usage:" in module._command_prompt("")
    prompt = module._command_prompt("a task manager")
    assert "skill_view(name='ultimate-builder:ultimate-app-builder')" in prompt
    assert "registered specialist skill" in prompt
    assert "a task manager" in prompt


def test_build_command_injects_normal_idrak_turn():
    module = load_plugin()
    ctx = Context()
    module.register(ctx)
    handler = next(row[1] for row in ctx.commands if row[0] == "ultimate-build")
    response = handler("a task manager")
    assert response == "Ultimate Builder started in the current Lyra conversation."
    assert len(ctx.injected) == 1
    assert "skill_view(name='ultimate-builder:ultimate-app-builder')" in ctx.injected[0]


def test_dashboard_enforces_requirements_gate_with_real_skill_loading():
    dashboard = (ROOT / "dashboard" / "dist" / "index.js").read_text()
    assert "first_turn_gate" in dashboard
    assert "Ask exactly ONE focused decision" in dashboard
    assert "use smart defaults" in dashboard
    assert "explicit user approval before coding" in dashboard
    assert "skill_view(name='ultimate-builder:<specialist-id>')" in dashboard
    assert "enabled_specialist_labels: enabledLabels" in dashboard
    assert "disabled_specialist_labels: disabledLabels" in dashboard
    assert "specialist_models: specialistModels" in dashboard
    assert "delegate_task.model" in dashboard
    assert '"LLM for " + skill[1]' in dashboard
    assert 'workspace: item.path' in dashboard
    assert 'window.location.href = "/chat?" + params.toString()' in dashboard
    assert "Use ultimate-builder:ultimate-app-builder" not in dashboard
