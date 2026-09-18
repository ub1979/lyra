"""Let the Studio coordinator queue and inspect durable project jobs without a shell.

The coordinator used to dispatch by running ``hermes project-run …`` through
the ``terminal`` tool, which also let it run anything else and pull whole
command outputs into the conversation. This tool exposes only the project-run
actions, returns the compact summary Studio already uses, and hides itself in
worker and delegated-child processes so a specialist can never queue more work.
"""

from __future__ import annotations

import importlib.util
import json
from pathlib import Path
from typing import Any, Optional

_ROOT = Path(__file__).resolve().parent
_ACTIONS = ("queue", "status", "pause", "resume", "stop", "retry", "preview")
_MAX_RESULT_CHARS = 8_000
_TRUNCATION_NOTE = (
    " …[project_run result truncated; ask for status with summary=true or "
    "for one job at a time]"
)
_modules: dict[str, Any] = {}

PROJECT_RUN_TOOL_SCHEMA = {
    "name": "project_run",
    "description": (
        "Queue, inspect, pause, resume, stop or retry one failed job in Lyra's durable background project "
        "jobs for one project workspace. This is the only way the coordinating "
        "conversation starts specialist work; it never edits files itself. "
        "Use action=preview when the visual preview is ready (or when there is none): "
        "it returns the exact question to ask with clarify. Development cannot be "
        "queued until the user answers that question."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "action": {"type": "string", "enum": list(_ACTIONS)},
            "workspace": {
                "type": "string",
                "description": "Absolute path of the selected project workspace.",
            },
            "phases": {
                "type": "string",
                "description": (
                    "Comma-separated specialist ids to queue in order, e.g. "
                    "'researcher,sw-architect' (queue only)."
                ),
            },
            "assignee": {"type": "string"},
            "models": {
                "type": "object",
                "additionalProperties": {"type": "string"},
                "description": "Optional phase → model overrides (queue only).",
            },
            "providers": {
                "type": "object",
                "additionalProperties": {"type": "string"},
                "description": "Optional phase → provider overrides (queue only).",
            },
            "force_new": {"type": "boolean"},
            "build_profile": {
                "type": "string", "enum": ["personal", "reusable", "production"],
                "description": "User-selected project scale for QA queueing. Omit for a legacy project.",
            },
            "task_id": {"type": "string", "description": "retry only: exact failed job id from status."},
            "reason": {"type": "string", "description": "retry only: why another attempt can succeed and the bounded remaining work. Never retry review/input waits or unchanged exhausted quota."},
            "summary": {
                "type": "boolean",
                "description": (
                    "Status only: return the short live summary (default true) "
                    "instead of the full job list."
                ),
            },
        },
        "required": ["action", "workspace"],
    },
}


def _sibling(name: str) -> Any:
    if name not in _modules:
        spec = importlib.util.spec_from_file_location(
            f"lyra_project_run_tool_{name}", _ROOT / f"{name}.py"
        )
        if spec is None or spec.loader is None:
            raise RuntimeError(f"Could not load {name}")
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        _modules[name] = module
    return _modules[name]


def coordinator_only() -> bool:
    """Hide the tool inside workers and delegated children; the handler re-checks the same gate."""
    return _sibling("project_runs").dispatch_blocked_reason() is None


def _string_map(value: Any) -> dict[str, str]:
    if not value:
        return {}
    if isinstance(value, dict):
        return {str(key).strip(): str(item).strip() for key, item in value.items()}
    if isinstance(value, list):
        return _sibling("project_run_cli")._mapping([str(item) for item in value])
    raise ValueError("models/providers must be an object of phase → value")


def _error(message: str) -> str:
    return json.dumps({"ok": False, "error": message}, ensure_ascii=False)


def _bounded(text: str) -> str:
    if len(text) <= _MAX_RESULT_CHARS:
        return text
    return text[: _MAX_RESULT_CHARS - len(_TRUNCATION_NOTE)] + _TRUNCATION_NOTE


def project_run_tool(args: dict, **_kwargs: Any) -> str:
    action = str(args.get("action") or "").strip().lower()
    workspace = str(args.get("workspace") or "").strip()
    # The schema gate only hides the tool; a call that reaches the handler
    # anyway (worker, delegated child) must fail here, not queue work.
    blocked = _sibling("project_runs").dispatch_blocked_reason()
    if blocked and action != "status":
        return _error(blocked)
    if action not in _ACTIONS:
        return _error(f"Unknown action {action!r}; use one of {', '.join(_ACTIONS)}.")
    if not workspace or not Path(workspace).is_absolute():
        return _error("workspace must be the absolute path of the selected project.")
    try:
        project_runs = _sibling("project_runs")
        if action == "queue":
            phases = [p.strip() for p in str(args.get("phases") or "").split(",") if p.strip()]
            if not phases:
                return _error("phases is required for queue, e.g. 'researcher,sw-architect'.")
            result = project_runs.queue_project_run(
                workspace,
                phases,
                assignee=str(args.get("assignee") or "").strip() or None,
                models=_string_map(args.get("models")),
                providers=_string_map(args.get("providers")),
                force_new=bool(args.get("force_new")),
                build_profile=str(args.get("build_profile") or "").strip() or None,
            )
        elif action == "retry":
            result = project_runs.retry_project_task(
                workspace, str(args.get("task_id") or "").strip(),
                str(args.get("reason") or "").strip(),
            )
        elif action == "preview":
            result = _sibling("preview_authorization").open_checkpoint(
                Path(workspace), str(_kwargs.get("session_id") or "")
            )
        elif action == "status":
            result = project_runs.project_run_state(workspace)
            if args.get("summary", True):
                from hermes_cli.project_run_summary import summarize_project_run

                result = summarize_project_run(result)
        else:
            result = project_runs.control_project_run(workspace, action)
    except Exception as exc:
        return _error(f"{type(exc).__name__}: {exc}")
    return _bounded(json.dumps(result, ensure_ascii=False, default=str))


def register_project_run_tool(ctx: Any) -> Optional[str]:
    """Attach the tool to the coordinator's ``project-guide`` bundle via the plugin loader."""
    if not hasattr(ctx, "register_tool"):
        return None
    ctx.register_tool(
        name="project_run",
        toolset="project-guide",
        schema=PROJECT_RUN_TOOL_SCHEMA,
        handler=project_run_tool,
        check_fn=coordinator_only,
        description="Queue, inspect and control durable Lyra project jobs.",
        emoji="🗂️",
    )
    return "project_run"
