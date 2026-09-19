"""Keep Lyra QA tool calls within testing and evidence responsibilities.

Uses Hermes' existing plugin veto hook. This is a workflow guard, not an OS
sandbox: terminal remains available for test commands, as required by QA.
"""

from __future__ import annotations

import os
from pathlib import Path

from hermes_cli import kanban_db as kb


QA_SKILLS = frozenset(f"ultimate-builder:{name}" for name in (
    "qa-engineer", "qa-evidence", "qa-functional", "qa-experience",
))
SCHEDULING = frozenset({"kanban_create", "kanban_link", "kanban_unblock", "delegate_task"})
FILE_WRITES = frozenset({"write_file", "patch"})


def _block(message: str) -> dict:
    return {"action": "block", "message": message}


def _test_or_evidence(path: Path, workspace: Path) -> bool:
    try:
        relative = path.resolve().relative_to(workspace.resolve())
    except ValueError:
        return False
    if not relative.parts:
        return False
    return (
        relative.parts[0] in {".sdlc", "tests", "test", "e2e", "__tests__"}
        or relative.as_posix() == "bug-report.md"
        or "__tests__" in relative.parts
        or ".test." in relative.name or ".spec." in relative.name
        or relative.name.startswith("test_")
        or relative.name in {"conftest.py", "playwright.config.ts", "playwright.config.js"}
    )


def guard_qa_tool(*, tool_name: str, args: dict, task_id: str = "", **_context) -> dict | None:
    """Identify the actual saved worker role, never a model-supplied role."""
    worker_id = os.environ.get("HERMES_KANBAN_TASK", "").strip()
    if not worker_id or tool_name not in SCHEDULING | FILE_WRITES:
        return None
    with kb.connect_closing() as conn:
        task = kb.get_task(conn, worker_id)
    if task is None or not QA_SKILLS.intersection(task.skills or ()):
        return None
    handoff = (
        "Save the failing criteria, evidence and exact retest command in a "
        "kanban_comment; use kanban_block(kind='needs_input') for coordinator "
        "routing. Do not repair application source through terminal either."
    )
    if tool_name in SCHEDULING:
        return _block("QA cannot schedule or rewire workers. " + handoff)
    workspace = Path(task.workspace_path).resolve() if task.workspace_path else None
    if workspace is None:
        return _block("QA has no saved workspace; request coordinator correction. " + handoff)
    paths = [args["path"]] if isinstance(args.get("path"), str) else []
    if tool_name == "patch" and args.get("mode") == "patch":
        from tools.patch_parser import parse_v4a_patch

        operations, error = parse_v4a_patch(str(args.get("patch") or ""))
        if error:
            return _block("Invalid QA patch: " + error)
        paths.extend(p for op in operations for p in (op.file_path, op.new_path) if p)
    if not paths:
        return _block("QA file edits require explicit test/evidence paths. " + handoff)
    from tools.file_tools import _resolve_path_for_task

    for name in paths:
        # Share file tools' session-cwd resolution, including terminal cd.
        # Guessing from the process cwd would miss edits into source folders.
        path = _resolve_path_for_task(name, task_id=task_id or "default")
        if not isinstance(path, Path) or not _test_or_evidence(path, workspace):
            return _block(f"QA may edit tests and evidence, not {name!r}. " + handoff)
    return None
