"""Lyra integration for the Ultimate Application Builder."""

from __future__ import annotations

from pathlib import Path


_ROOT = Path(__file__).resolve().parent

_SPECIALIST_SKILLS = {
    "req-engineer": "Requirements engineering",
    "spec": "Technical specification",
    "sw-architect": "Software architecture",
    "task-planner": "Implementation task planning",
    "proj-manager": "Human project planning",
    "sw-developer": "Software development",
    "oop-restructurer": "Code restructuring",
    "debugger": "Systematic debugging",
    "code-reviewer": "Code review",
    "qa-engineer": "Quality assurance",
    "security-auditor": "Security auditing",
    "devops-engineer": "Deployment and operations",
    "tech-writer": "Technical documentation",
    "benchmark": "Performance benchmarking",
    "health": "Health checks",
    "context-save": "Context preservation",
    "learn": "Controlled learning",
    "idk_it": "Workflow coordination",
}


def _command_prompt(raw_args: str) -> str:
    brief = raw_args.strip()
    if not brief:
        return (
            "Usage: /ultimate-build <what you want to build>\n"
            "Example: /ultimate-build a private task manager with email login"
        )
    return (
        "Start the Ultimate Application Builder workflow now. Load it first with "
        "skill_view(name='ultimate-builder:ultimate-app-builder') and follow its "
        "gates. Load each phase's registered specialist skill before running that "
        "phase. Use the current working directory as the project workspace.\n\n"
        f"Build brief:\n{brief}"
    )


def _status_prompt(raw_args: str) -> str:
    target = raw_args.strip() or "the current working directory"
    return (
        "Load skill_view(name='ultimate-builder:ultimate-app-builder') in "
        f"status-only mode. Inspect {target}, read its .sdlc ledger and reports, and summarize the "
        "current phase, open high-severity findings, evidence, and next safe action. "
        "Do not mutate the project."
    )


def register(ctx) -> None:
    def start_build(raw_args: str) -> str:
        prompt = _command_prompt(raw_args)
        if prompt.startswith("Usage:"):
            return prompt
        if ctx.inject_message(prompt):
            return "Ultimate Builder started in the current Lyra conversation."
        return (
            "This remote session cannot inject a follow-up turn automatically. "
            "Send the following as a normal Chat message:\n\n" + prompt
        )

    def inspect_status(raw_args: str) -> str:
        prompt = _status_prompt(raw_args)
        if ctx.inject_message(prompt):
            return "Ultimate Builder status inspection started."
        return (
            "This remote session cannot inject a follow-up turn automatically. "
            "Send the following as a normal Chat message:\n\n" + prompt
        )

    ctx.register_skill(
        "app-it",
        _ROOT / "skills" / "app-it" / "SKILL.md",
        description=(
            "Understand an application project, recommend the smallest useful "
            "specialist team, and coordinate approved work."
        ),
    )
    ctx.register_skill(
        "ultimate-app-builder",
        _ROOT / "skills" / "ultimate-app-builder" / "SKILL.md",
        description=(
            "Build, fix, review, test, secure, document, and ship applications "
            "through an evidence-backed SDLC with isolated Lyra delegates."
        ),
    )
    workflow_root = (
        _ROOT / "skills" / "ultimate-app-builder" / "references" / "workflows"
    )
    for name, description in _SPECIALIST_SKILLS.items():
        ctx.register_skill(
            name,
            workflow_root / name / "SKILL.md",
            description=description,
        )
    ctx.register_command(
        "ultimate-build",
        handler=start_build,
        description="Create an application with the Ultimate Builder workflow.",
        args_hint="<application brief>",
    )
    ctx.register_command(
        "ultimate-status",
        handler=inspect_status,
        description="Inspect an Ultimate Builder project's current SDLC status.",
        args_hint="[project path]",
    )
