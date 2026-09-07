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
from hermes_cli.project_job_status import project_job_dispatch_issue, validate_project_worker
from hermes_cli.project_job_attention import task_attention
from hermes_cli.kanban_notifications import subscribe_task_origin


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
QUIET_ACTIVITY_SECONDS = 2 * 60
STALLED_ACTIVITY_SECONDS = 10 * 60

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


def _ensure_project_repository(project: Path) -> dict[str, object]:
    path = Path(__file__).resolve().with_name("project_repository.py")
    spec = importlib.util.spec_from_file_location(
        "lyra_ultimate_builder_project_repository_for_jobs", path
    )
    if spec is None or spec.loader is None:
        raise RuntimeError("Could not load project Git isolation")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    checkout = Path(__file__).resolve().parents[2]
    return module.ensure_project_repository(
        project,
        lyra_checkout=checkout,
        managed_roots=(checkout / "my_projects", checkout / "song-maker-studio"),
    )


def _ensure_project_status(project: Path) -> dict[str, Any]:
    """Create the compact recovery snapshot before a worker can start."""
    modules = {}
    for name in ("project_progress", "project_status"):
        path = Path(__file__).resolve().with_name(f"{name}.py")
        spec = importlib.util.spec_from_file_location(
            f"lyra_ultimate_builder_{name}_for_jobs", path
        )
        if spec is None or spec.loader is None:
            raise RuntimeError(f"Could not load {name}")
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        modules[name] = module
    return modules["project_status"].load_project_status(
        project, modules["project_progress"]._parse_progress_ledger
    )


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


def _activity_health(
    status: str, last_activity_at: int | None, *, now: int | None = None
) -> tuple[str, int | None]:
    """Classify visibility only; the dispatcher remains recovery authority."""
    if status != "running":
        return "settled", None
    current = int(time.time()) if now is None else int(now)
    if last_activity_at is None:
        return "stalled", None
    age = max(0, current - int(last_activity_at))
    if age >= STALLED_ACTIVITY_SECONDS:
        return "stalled", age
    if age >= QUIET_ACTIVITY_SECONDS:
        return "quiet", age
    return "fresh", age


def _validate_routing(
    phases: set[str], models: dict[str, str], providers: dict[str, str]
) -> None:
    if set(models).difference(phases) or set(providers).difference(phases):
        raise ValueError("Model routing contains a phase outside the selected team")
    for phase in phases:
        model = str(models.get(phase) or "").strip()
        provider = str(providers.get(phase) or "").strip()
        if bool(model) != bool(provider):
            missing = "provider" if model else "model"
            raise ValueError(f"Routing for {phase} requires its {missing}")


def _project_tasks(
    project: Path, *, include_archived: bool = True
) -> list[tuple[str, kb.Task]]:
    """Find every job belonging to this exact workspace, regardless of creator."""
    found: list[tuple[str, kb.Task]] = []
    for board_meta in kb.list_boards(include_archived=False):
        board = str(board_meta.get("slug") or board_meta.get("id") or "default")
        try:
            with kb.connect_closing(board=board) as conn:
                for task in kb.list_tasks(
                    conn, include_archived=include_archived, workspace_path=str(project)
                ):
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

Read the repository instructions and `.sdlc/status.json` first when present. It is the compact current-state snapshot. Read `.sdlc/progress.md` only when the snapshot is missing, older than the ledger, or you need historical evidence; then read the Project Brain and only the requirements/plan sections needed for this phase. Adopt existing partial work; never restart completed work merely because this is a recovered job. Preserve unrelated user changes. Before editing, verify `git rev-parse --show-toplevel` resolves to this exact workspace, then inspect Git status. Run every Git command from this project root; never stage or commit files in Lyra's application repository. Work only in this project.

Update `.sdlc/progress.md` to running when work starts; Lyra regenerates `.sdlc/status.json` atomically from that ledger, so do not hand-edit the snapshot. Perform the real work and verification required by the loaded specialist playbook. Save every project change in a local Git commit after verification, staging only files from this task. The project repository is prepared before dispatch; stop and report an isolation error if its root is no longer this workspace. Never push to a remote unless the user separately asks in their main Lyra conversation.

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
    _validate_routing(set(requested), models, providers)
    origin = _origin()
    worker_profile = assignee or str(origin["profile"] or "default")
    validate_project_worker(worker_profile)
    repository = _ensure_project_repository(project)
    status_snapshot = _ensure_project_status(project)
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
            model = models.get(phase) or None
            provider = providers.get(phase) or None
            previous = latest_by_phase.get(phase)
            if (
                previous
                and not force_new
                and previous[1].status in ACTIVE_STATUSES | {"done"}
            ):
                task = previous[1]
                with kb.connect_closing(board=previous[0]) as origin_conn:
                    subscribed = subscribe_task_origin(origin_conn, task.id)
                    if task.status != "done":
                        # Reopening a project must also adopt its current model
                        # routing. Otherwise a queued Ollama override survives a
                        # later switch to Claude and is retried against the wrong
                        # provider indefinitely. An omitted model deliberately
                        # clears both overrides (Follow project model).
                        kb.set_model_override(
                            origin_conn, task.id, model, provider=provider
                        )
                created.append({
                    "task_id": task.id,
                    "phase": phase,
                    "status": task.status,
                    "reused": True,
                    "subscribed": subscribed,
                })
                parent_ids = [task.id]
                continue
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
            subscribed = subscribe_task_origin(conn, task_id)
            task = kb.get_task(conn, task_id)
            created.append({
                "task_id": task_id,
                "phase": phase,
                "status": task.status if task else "ready",
                "reused": False,
                "subscribed": subscribed,
            })
            parent_ids = [task_id]
    return {
        "ok": True,
        "project": str(project),
        "board": board,
        "tasks": created,
        "repository": repository,
        "status_snapshot": {
            "path": ".sdlc/status.json",
            "updated_at": status_snapshot["updated_at"],
        },
        "message": "Project agents were saved as recoverable background jobs.",
    }


def sync_project_run_routing(
    workspace: str | Path,
    phases: Iterable[str],
    *,
    models: dict[str, str] | None = None,
    providers: dict[str, str] | None = None,
) -> dict[str, Any]:
    """Synchronize active project jobs with a user-confirmed routing map."""
    project = _workspace(workspace)
    requested = {str(phase).strip() for phase in phases if str(phase).strip()}
    # Studio submits its whole team. Interactive/support specialists are valid
    # selections even though they have no durable phase job to update.
    support_specialists = {"req-engineer", "oop-restructurer", "health", "learn"}
    unknown = requested.difference(PHASES).difference(support_specialists)
    if unknown:
        raise ValueError(f"Unknown project phase: {', '.join(sorted(unknown))}")

    models = models or {}
    providers = providers or {}
    _validate_routing(requested, models, providers)

    changed: list[str] = []
    for board, task in _project_tasks(project, include_archived=False):
        phase = _phase_from_task(task)
        if phase not in requested or task.status == "done":
            continue
        model = models.get(phase) or None
        provider = providers.get(phase) or None
        if task.model_override == model and task.provider_override == provider:
            continue
        with kb.connect_closing(board=board) as conn:
            kb.set_model_override(conn, task.id, model, provider=provider)
        changed.append(task.id)
    return {"project": str(project), "changed": changed}


def project_run_state(workspace: str | Path) -> dict[str, Any]:
    project = _workspace(workspace)
    tasks = _project_tasks(project, include_archived=True)
    latest: dict[str, tuple[str, kb.Task]] = {}
    for item in tasks:
        phase = _phase_from_task(item[1])
        # Generic project jobs have their own identity. Never hide them or merge
        # them into a completed specialist phase based on a title or skill name.
        key = phase if phase in PHASES else f"job:{item[0]}:{item[1].id}"
        if key not in latest or item[1].created_at >= latest[key][1].created_at:
            latest[key] = item
    items = []
    for phase, (board, task) in latest.items():
        # Waiting for a decision is not a worker failure. Expose the saved
        # reason separately so Studio can explain it without guessing from chat.
        with kb.connect_closing(board=board) as conn:
            attention = task_attention(conn, task)
        last_activity_at = (
            task.last_heartbeat_at
            or task.completed_at
            or task.started_at
            or task.created_at
        )
        activity_health, activity_age_seconds = _activity_health(
            task.status, last_activity_at
        )
        items.append({
            "phase": phase,
            "label": PHASES[phase]["label"] if phase in PHASES else task.title,
            "task_id": task.id,
            "board": board,
            "status": task.status,
            "dispatch_issue": project_job_dispatch_issue(task),
            "attempts": task.consecutive_failures,
            "last_error": task.last_failure_error or "",
            "block_kind": task.block_kind if task.status in {"blocked", "triage"} else None,
            **attention,
            "paused_by_user": attention["wait_reason"] == PAUSE_REASON,
            "last_activity_at": last_activity_at,
            "activity_health": activity_health,
            "activity_age_seconds": activity_age_seconds,
        })
    items.sort(key=lambda item: int(item["last_activity_at"] or 0))
    active = [
        item for item in items
        if item["status"] in RUNNING_STATUSES and not item["dispatch_issue"]
    ]
    blocked = [
        item for item in items
        if item["status"] in {"blocked", "triage"}
        or item["dispatch_issue"]
        or item["activity_health"] == "stalled"
    ]
    running = any(item["status"] == "running" for item in items)
    state = "needs_attention" if blocked else "working" if running else "queued" if active else "idle"
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
