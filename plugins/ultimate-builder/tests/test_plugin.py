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
    assert [row[0] for row in ctx.skills] == ["ultimate-app-builder"]
    assert ctx.skills[0][1].is_file()
    assert {row[0] for row in ctx.commands} == {"ultimate-build", "ultimate-status"}


def test_build_command_requires_brief():
    module = load_plugin()
    assert "Usage:" in module._command_prompt("")
    prompt = module._command_prompt("a task manager")
    assert "ultimate-builder:ultimate-app-builder" in prompt
    assert "a task manager" in prompt


def test_build_command_injects_normal_idrak_turn():
    module = load_plugin()
    ctx = Context()
    module.register(ctx)
    handler = next(row[1] for row in ctx.commands if row[0] == "ultimate-build")
    response = handler("a task manager")
    assert response == "Ultimate Builder started in the current Idrak IT conversation."
    assert len(ctx.injected) == 1
    assert "ultimate-builder:ultimate-app-builder" in ctx.injected[0]
