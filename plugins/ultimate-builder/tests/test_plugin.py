from __future__ import annotations

import importlib.util
from pathlib import Path

from lyra_version import LYRA_CHANNEL, LYRA_VERSION


ROOT = Path(__file__).resolve().parents[1]
DASHBOARD_ENTRY = ROOT / "dashboard" / "app" / "index.js"
DASHBOARD_DIST_ENTRY = ROOT / "dashboard" / "dist" / "index.js"


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
    assert skill_names[:2] == ["app-it", "ultimate-app-builder"]
    assert set(skill_names[2:]) == set(module._SPECIALIST_SKILLS)
    assert len(skill_names) == len(module._SPECIALIST_SKILLS) + 2
    assert all(row[1].is_file() for row in ctx.skills)
    assert {row[0] for row in ctx.commands} == {"ultimate-build", "ultimate-status"}


def test_build_command_requires_brief(tmp_path):
    module = load_plugin()
    assert "Usage:" in module._command_prompt("")
    prompt = module._command_prompt("a task manager", cwd=tmp_path)
    assert "skill_view(name='ultimate-builder:ultimate-app-builder')" in prompt
    assert "registered specialist skill" in prompt
    assert "a task manager" in prompt


def test_build_command_injects_normal_idrak_turn(tmp_path, monkeypatch):
    module = load_plugin()
    monkeypatch.chdir(tmp_path)
    ctx = Context()
    module.register(ctx)
    handler = next(row[1] for row in ctx.commands if row[0] == "ultimate-build")
    response = handler("a task manager")
    assert response == "Ultimate Builder started in the current Lyra conversation."
    assert len(ctx.injected) == 1
    assert "skill_view(name='ultimate-builder:ultimate-app-builder')" in ctx.injected[0]


def test_build_command_protects_lyra_checkout():
    module = load_plugin()
    message = module._command_prompt("change the dashboard", cwd=module._LYRA_CHECKOUT)
    assert message.startswith("Lyra protected its own application folder")
    assert str(module._LYRA_CHECKOUT / "my_projects") in message
    allowed = module._command_prompt(
        "build a task manager",
        cwd=module._LYRA_CHECKOUT / "my_projects" / "task-manager",
    )
    assert "Start the Ultimate Application Builder workflow now" in allowed


def test_dashboard_enforces_requirements_gate_with_real_skill_loading():
    dashboard = DASHBOARD_ENTRY.read_text()
    assert "first_turn_gate" in dashboard
    assert "warm one-sentence greeting" in dashboard
    assert "ask exactly ONE short product question" in dashboard
    assert "ask permission before adding it" in dashboard
    assert "Do not write code before the team and requirements are approved" in dashboard
    assert "Start with the internal ultimate-builder:app-it skill" in dashboard
    expected_version = f"v{LYRA_VERSION} {LYRA_CHANNEL}"
    assert expected_version in dashboard
    assert "Meet App IT" not in dashboard
    assert "APP_IT_SKILLS_SET" in dashboard
    assert "skill_view(name='ultimate-builder:<specialist-id>')" in dashboard
    assert "enabled_specialist_labels: enabledLabels" in dashboard
    assert "disabled_specialist_labels: disabledLabels" in dashboard
    assert "specialist_models: specialistModels" in dashboard
    assert "delegate_task.model" in dashboard
    assert '"LLM for " + skill[1]' in dashboard
    assert 'requireSafeWorkspace(item.path)' in dashboard
    assert 'api.getDefaultCwd()' in dashboard
    assert 'defaultProjectsRoot(cwd)' in dashboard
    assert 'workspace-safety?path=' in dashboard
    assert 'workspace = await requireSafeWorkspace(workspace)' in dashboard
    assert 'api.getSessions(20, 0, undefined, "recent", workspace)' in dashboard
    assert 'params.set("resume", sessionId)' in dashboard
    assert 'window.location.href = "/chat?" + params.toString()' in dashboard
    assert 'postProjectAction("/project/move"' in dashboard
    assert 'postProjectAction("/project/delete"' in dashboard
    assert 'postProjectAction("/project/register"' in dashboard
    assert '"Move"' in dashboard
    assert '"Remove"' in dashboard
    assert '"Trash"' in dashboard
    assert '"Lyra Studio"' in dashboard
    assert '"Turn an idea into software."' in dashboard
    assert '"Customize team"' in dashboard
    assert '"Use dark mode"' in dashboard
    assert '"Use light mode"' in dashboard
    assert '"lyra-studio-color-mode"' in dashboard
    assert 'ub-theme-" + studioTheme' in dashboard
    assert '"lyra-studio-text-size"' in dashboard
    assert '"Text size"' in dashboard
    assert 'ub-text-" + studioTextSize' in dashboard
    assert "teamSizeLabel(template.skills)" in dashboard
    assert 'disabled: starting || !selected.size' not in dashboard
    assert "Use ultimate-builder:ultimate-app-builder" not in dashboard


def test_built_dashboard_uses_the_same_product_version():
    expected_version = f"v{LYRA_VERSION} {LYRA_CHANNEL}"
    assert expected_version in DASHBOARD_DIST_ENTRY.read_text()


def test_start_script_launches_dashboard_from_ignored_project_root():
    start_script = (ROOT.parents[1] / "start.sh").read_text()
    assert 'WORKSPACE_DIR="$PROJECT_DIR/my_projects"' in start_script
    assert 'cd "$WORKSPACE_DIR"' in start_script
    assert 'uv run --project "$PROJECT_DIR" hermes dashboard' in start_script


def test_manifest_uses_the_non_conflicting_dashboard_entry():
    manifest = (ROOT / "dashboard" / "manifest.json").read_text()
    assert '"entry": "app/index.js"' in manifest


def test_skills_define_chat_first_tool_recovery_and_website_research():
    skill_root = ROOT / "skills"
    umbrella = (skill_root / "ultimate-app-builder" / "SKILL.md").read_text()
    guide = (skill_root / "app-it" / "SKILL.md").read_text()
    req_root = (
        skill_root
        / "ultimate-app-builder"
        / "references"
        / "workflows"
        / "req-engineer"
    )
    requirements = (req_root / "SKILL.md").read_text()
    site_research = (req_root / "references" / "site-research.md").read_text()

    assert "every Hermes tool present in the live session schema" in umbrella
    assert "/tools enable <toolset>" in umbrella
    assert "masked secret prompt" in umbrella
    assert "Do not send the user to a Settings page" in guide
    assert "website URLs and reference documents" in requirements
    assert "references/site-research.md" in requirements
    assert "/tools enable web browser" in requirements
    assert "Do not use a vague" in requirements
    assert "web_extract" in site_research
    assert "browser_navigate" in site_research
    assert "Never silently skip source research" in site_research
    assert "Never claim “the whole website was analysed.”" in site_research


def test_project_guide_translates_engineering_progress_for_nontechnical_users():
    skill_root = ROOT / "skills"
    umbrella = (skill_root / "ultimate-app-builder" / "SKILL.md").read_text()
    guide = (skill_root / "app-it" / "SKILL.md").read_text()
    chat = (ROOT.parents[1] / "web" / "src" / "pages" / "ChatPage.tsx").read_text()

    assert "Assume the user is not technical" in guide
    assert "Is the whole application finished" in guide
    assert "This part is done;\nthe application is not finished yet." in guide
    assert "The application is not finished yet" in umbrella
    assert "Never show roadmap codes such as R16" in chat
    assert "what now works, what remains" in chat
