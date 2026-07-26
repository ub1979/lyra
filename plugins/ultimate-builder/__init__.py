"""Hermes integration for the Ultimate Application Builder."""

from __future__ import annotations

from pathlib import Path


_ROOT = Path(__file__).resolve().parent


def _command_prompt(raw_args: str) -> str:
    brief = raw_args.strip()
    if not brief:
        return (
            "Usage: /ultimate-build <what you want to build>\n"
            "Example: /ultimate-build a private task manager with email login"
        )
    return (
        "Start the Ultimate Application Builder workflow now. "
        "Load the skill `ultimate-builder:ultimate-app-builder`, follow its gates, "
        "and use the current working directory as the project workspace.\n\n"
        f"Build brief:\n{brief}"
    )


def _status_prompt(raw_args: str) -> str:
    target = raw_args.strip() or "the current working directory"
    return (
        "Load `ultimate-builder:ultimate-app-builder` in status-only mode. "
        f"Inspect {target}, read its .sdlc ledger and reports, and summarize the "
        "current phase, open high-severity findings, evidence, and next safe action. "
        "Do not mutate the project."
    )


def register(ctx) -> None:
    ctx.register_skill(
        "ultimate-app-builder",
        _ROOT / "skills" / "ultimate-app-builder" / "SKILL.md",
        description=(
            "Build, fix, review, test, secure, document, and ship applications "
            "through an evidence-backed SDLC with isolated Hermes delegates."
        ),
    )
    ctx.register_command(
        "ultimate-build",
        handler=_command_prompt,
        description="Create an application with the Ultimate Builder workflow.",
        args_hint="<application brief>",
    )
    ctx.register_command(
        "ultimate-status",
        handler=_status_prompt,
        description="Inspect an Ultimate Builder project's current SDLC status.",
        args_hint="[project path]",
    )
