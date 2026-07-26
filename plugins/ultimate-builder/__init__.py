"""Idrak IT integration for the Ultimate Application Builder."""

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
    def start_build(raw_args: str) -> str:
        prompt = _command_prompt(raw_args)
        if prompt.startswith("Usage:"):
            return prompt
        if ctx.inject_message(prompt):
            return "Ultimate Builder started in the current Idrak IT conversation."
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
        "ultimate-app-builder",
        _ROOT / "skills" / "ultimate-app-builder" / "SKILL.md",
        description=(
            "Build, fix, review, test, secure, document, and ship applications "
            "through an evidence-backed SDLC with isolated Idrak IT delegates."
        ),
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
