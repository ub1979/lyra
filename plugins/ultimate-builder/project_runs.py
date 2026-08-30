"""Durable Ultimate Builder phase runs backed by Hermes Kanban."""

from __future__ import annotations

import hashlib
import importlib.util
import json
import os
import time
from pathlib import Path
from typing import Any, Iterable

from hermes_cli import kanban_db as kb


TASK_KEY_PREFIX = "lyra-project:v1:"
PAUSE_REASON = "lyra-project-paused-by-user"
ACTIVE_STATUSES = frozenset({
    "todo",
    "ready",
    "running",
    "blocked",
    "triage",
    "scheduled",
})
RUNNING_STATUSES = frozenset({"todo", "ready", "running", "scheduled"})

PHASES: dict[str, dict[str, str]] = {
    "researcher": {"label": "Research", "artifact": "research-report.md"},
    "ui-designer": {"label": "Visual design", "artifact": "design-brief.md"},
    "sw-architect": {"label": "Architecture", "artifact": "plan.md"},
    "spec": {"label": "Specification", "artifact": "spec.md"},
    "task-planner": {"label": "Task planning", "artifact": "task-graph.md"},
    "proj-manager": {"label": "Project planning", "artifact": "project-plan.md"},
    "sw-developer": {"label": "Development", "artifact": "working application"},
    "debugger": {"label": "Debugging", "artifact": "root-cause evidence"},
    "code-reviewer": {"label": "Code review", "artifact": "review-report.md"},
    "ux-writer": {"label": "UX writing", "artifact": "UX copy"},
    "qa-engineer": {"label": "Quality assurance", "artifact": "bug-report.md"},
    "security-auditor": {"label": "Security", "artifact": "security-report.md"},
    "a11y-auditor": {"label": "Accessibility", "artifact": "accessibility evidence"},
    "devops-engineer": {"label": "Deployment", "artifact": "DEPLOYMENT.md"},
    "tech-writer": {"label": "Documentation", "artifact": "README.md and docs"},
    "benchmark": {"label": "Performance", "artifact": "benchmark-report.md"},
    "context-save": {"label": "Project Brain", "artifact": ".sdlc/project-brain.md"},
}


def _project_brain_contract() -> str:
    path = Path(__file__).resolve().parent / "project_brain.py"
    spec = importlib.util.spec_from_file_location(
        "lyra_ultimate_builder_project_brain_for_jobs", path
    )
    if spec is None or spec.loader is None:
        raise RuntimeError("Could not load Project Brain contract")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return str(module.PROJECT_BRAIN_CONTRACT)


def _workspace(path: str | Path) -> Path:
    project = Path(path).expanduser().resolve(strict=False)
    if not project.is_dir():
        raise ValueError(f"Project directory does not exist: {project}")
    return project


def _workspace_digest(project: Path) -> str:
    return hashlib.sha256(str(project).encode("utf-8")).hexdigest()[:16]


def _phase_from_task(task: kb.Task) -> str | None:
    key = task.idempotency_key or ""
    if not key.startswith(TASK_KEY_PREFIX):
        return None
    parts = key.split(":")
    return parts[3] if len(parts) >= 5 else None


def _project_tasks(
    project: Path, *, include_archived: bool = True
) -> list[tuple[str, kb.Task]]:
    found: list[tuple[str, kb.Task]] = []
    for board_meta in kb.list_boards(include_archived=False):
        board = str(board_meta.get("slug") or board_meta.get("id") or "default")
        try:
            with kb.connect_closing(board=board) as conn:
                for task in kb.list_tasks(conn, include_archived=include_archived):
                    if not (task.idempotency_key or "").startswith(TASK_KEY_PREFIX):
                        continue
                    if not task.workspace_path:
                        continue
                    candidate = (
                        Path(task.workspace_path).expanduser().resolve(strict=False)
                    )
                    if candidate == project:
                        found.append((board, task))
        except (OSError, ValueError):
            continue
    return found


def _task_body(project: Path, phase: str) -> str:
    info = PHASES[phase]
    return f"""You are Lyra's durable {info["label"]} agent for this project.

Workspace: {project}
Required outcome: complete the {info["label"]} phase and leave {info["artifact"]} as evidence.

{_project_brain_contract()}

Read the repository instructions, then the Project Brain, requirements.md, plan.md, and .sdlc/progress.md when present. Adopt existing partial work; never restart completed work merely because this is a recovered job. Preserve unrelated user changes. Before editing, inspect Git status. Work only in this project.

Update .sdlc/progress.md to running when work starts. Perform the real work and verification required by the loaded specialist playbook. Save every project change in a local Git commit after verification, staging only files from this task. Initialize Git and create a baseline commit first if needed. Never push to a remote unless the user separately asks in their main Lyra conversation.

Before finishing, update the ledger to verified or blocked with plain evidence paths. Use the Kanban completion action only when the phase is genuinely complete; otherwise use the Kanban block action with the exact user decision or missing capability needed. Your final summary must be plain language: what the user can do now, whether the whole application is finished, what remains, and any blocker. Do not lead with roadmap codes, schema names, or raw test counts.
"""


def _origin() -> dict[str, str | None]:
    platform = os.environ.get("HERMES_SESSION_PLATFORM", "").strip()
    chat_id = os.environ.get("HERMES_SESSION_CHAT_ID", "").strip()
    session_key = os.environ.get("HERMES_SESSION_KEY", "").strip()
    if not platform or not chat_id:
        platform = "tui" if session_key else ""
        chat_id = session_key
    return {
        "platform": platform,
        "chat_id": chat_id,
        "thread_id": os.environ.get("HERMES_SESSION_THREAD_ID", "").strip() or None,
        "user_id": os.environ.get("HERMES_SESSION_USER_ID", "").strip() or None,
        "profile": os.environ.get("HERMES_SESSION_PROFILE", "").strip()
        or os.environ.get("HERMES_PROFILE", "").strip()
        or "default",
        "session_id": os.environ.get("HERMES_SESSION_ID", "").strip()
        or session_key
        or None,
    }


def queue_project_run(
    workspace: str | Path,
    phases: Iterable[str],
    *,
    assignee: str | None = None,
    models: dict[str, str] | None = None,
    providers: dict[str, str] | None = None,
    force_new: bool = False,
) -> dict[str, Any]:
    project = _workspace(workspace)
    requested = [str(phase).strip() for phase in phases if str(phase).strip()]
    if not requested:
        raise ValueError("At least one project phase is required")
    unknown = [phase for phase in requested if phase not in PHASES]
    if unknown:
        raise ValueError(f"Unknown project phase: {', '.join(unknown)}")

    models = models or {}
    providers = providers or {}
    origin = _origin()
    worker_profile = assignee or str(origin["profile"] or "default")
    board = kb.get_current_board()
    existing = _project_tasks(project, include_archived=True)
    latest_by_phase: dict[str, tuple[str, kb.Task]] = {}
    for item in existing:
        phase = _phase_from_task(item[1])
        if phase and (
            phase not in latest_by_phase
            or item[1].created_at >= latest_by_phase[phase][1].created_at
        ):
            latest_by_phase[phase] = item

    created: list[dict[str, Any]] = []
    parent_ids: list[str] = []
    run_token = f"{int(time.time())}-{os.getpid()}"
    with kb.connect_closing(board=board) as conn:
        for phase in requested:
            previous = latest_by_phase.get(phase)
            if (
                previous
                and not force_new
                and previous[1].status in ACTIVE_STATUSES | {"done"}
            ):
                task = previous[1]
                created.append({
                    "task_id": task.id,
                    "phase": phase,
                    "status": task.status,
                    "reused": True,
                })
                parent_ids = [task.id]
                continue
            model = models.get(phase) or None
            provider = providers.get(phase) or None
            task_id = kb.create_task(
                conn,
                title=f"Lyra project: {PHASES[phase]['label']}",
                body=_task_body(project, phase),
                assignee=worker_profile,
                created_by="lyra-project-guide",
                workspace_kind="dir",
                workspace_path=str(project),
                parents=tuple(parent_ids),
                idempotency_key=(
                    f"{TASK_KEY_PREFIX}{_workspace_digest(project)}:{phase}:{run_token}"
                ),
                max_runtime_seconds=6 * 60 * 60,
                max_retries=3,
                skills=(
                    "ultimate-builder:ultimate-app-builder",
                    f"ultimate-builder:{phase}",
                ),
                model_override=model,
                provider_override=provider,
                goal_mode=True,
                goal_max_turns=30,
                session_id=origin["session_id"],
            )
            if origin["platform"] and origin["chat_id"]:
                kb.add_notify_sub(
                    conn,
                    task_id=task_id,
                    platform=str(origin["platform"]),
                    chat_id=str(origin["chat_id"]),
                    thread_id=origin["thread_id"],
                    user_id=origin["user_id"],
                    notifier_profile=str(origin["profile"]),
                )
            task = kb.get_task(conn, task_id)
            created.append({
                "task_id": task_id,
                "phase": phase,
                "status": task.status if task else "ready",
                "reused": False,
            })
            parent_ids = [task_id]
    return {
        "ok": True,
        "project": str(project),
        "board": board,
        "tasks": created,
        "message": "Project agents were saved as recoverable background jobs.",
    }


def project_run_state(workspace: str | Path) -> dict[str, Any]:
    project = _workspace(workspace)
    tasks = _project_tasks(project, include_archived=True)
    latest: dict[str, tuple[str, kb.Task]] = {}
    for item in tasks:
        phase = _phase_from_task(item[1])
        if (
            phase
            and phase in PHASES
            and (
                phase not in latest or item[1].created_at >= latest[phase][1].created_at
            )
        ):
            latest[phase] = item
    items = []
    for phase, (board, task) in latest.items():
        items.append({
            "phase": phase,
            "label": PHASES[phase]["label"],
            "task_id": task.id,
            "board": board,
            "status": task.status,
            "attempts": task.consecutive_failures,
            "last_error": task.last_failure_error or "",
            "last_activity_at": task.last_heartbeat_at
            or task.completed_at
            or task.started_at
            or task.created_at,
        })
    items.sort(key=lambda item: int(item["last_activity_at"] or 0))
    active = [item for item in items if item["status"] in RUNNING_STATUSES]
    blocked = [item for item in items if item["status"] in {"blocked", "triage"}]
    state = "working" if active else "needs_attention" if blocked else "idle"
    return {
        "available": bool(items),
        "state": state,
        "active": bool(active),
        "task_count": len(items),
        "active_task_count": len(active),
        "last_activity_at": max(
            (int(item["last_activity_at"] or 0) for item in items), default=None
        ),
        "tasks": items,
    }


def control_project_run(workspace: str | Path, action: str) -> dict[str, Any]:
    project = _workspace(workspace)
    action = action.strip().lower()
    if action not in {"pause", "resume", "stop"}:
        raise ValueError("Action must be pause, resume, or stop")
    changed: list[str] = []
    for board, snapshot in _project_tasks(project, include_archived=False):
        with kb.connect_closing(board=board) as conn:
            task = kb.get_task(conn, snapshot.id)
            if task is None:
                continue
            if action == "pause" and task.status in {"running", "ready"}:
                if task.status == "running" and not kb.reclaim_task(
                    conn, task.id, reason=PAUSE_REASON
                ):
                    continue
                if kb.block_task(
                    conn, task.id, reason=PAUSE_REASON, kind="needs_input"
                ):
                    changed.append(task.id)
            elif action == "resume" and task.status == "blocked":
                events = kb.list_events(conn, task.id)
                last_block = next(
                    (event for event in reversed(events) if event.kind == "blocked"),
                    None,
                )
                reason = (
                    (last_block.payload or {}).get("reason") if last_block else None
                )
                if reason == PAUSE_REASON and kb.unblock_task(conn, task.id):
                    changed.append(task.id)
            elif action == "stop" and task.status in ACTIVE_STATUSES:
                if task.status == "running" and not kb.reclaim_task(
                    conn, task.id, reason="Stopped by user"
                ):
                    continue
                if kb.archive_task(conn, task.id):
                    changed.append(task.id)
    return {"ok": True, "action": action, "changed": changed, "project": str(project)}


def relocate_project_runs(
    source: str | Path, destination: str | Path
) -> dict[str, Any]:
    """Keep durable project jobs attached when their project folder moves."""
    old = Path(source).expanduser().resolve(strict=False)
    new = Path(destination).expanduser().resolve(strict=False)
    changed: list[str] = []
    for board, snapshot in _project_tasks(old, include_archived=True):
        with kb.connect_closing(board=board) as conn:
            task = kb.get_task(conn, snapshot.id)
            if task is None:
                continue
            body = (task.body or "").replace(str(old), str(new))
            with kb.write_txn(conn):
                conn.execute(
                    "UPDATE tasks SET workspace_path = ?, body = ? WHERE id = ?",
                    (str(new), body, task.id),
                )
            changed.append(task.id)
    return {
        "ok": True,
        "source": str(old),
        "destination": str(new),
        "changed": changed,
    }


def print_json(value: dict[str, Any]) -> None:
    print(json.dumps(value, ensure_ascii=False, indent=2))
