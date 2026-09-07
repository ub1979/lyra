"""Parse project progress conservatively and separate reports from evidence."""

import re
from pathlib import Path
from typing import Any

from hermes_cli.project_evidence import evidence_paths, inspect_evidence


_PHASE_IDS = (
    (re.compile(r"\brequirements?\b", re.I), "req-engineer"),
    (re.compile(r"\bresearch\b", re.I), "researcher"),
    (re.compile(r"\b(?:ui|ux|visual)?\s*design\b", re.I), "ui-designer"),
    (re.compile(r"\barchitecture\b", re.I), "sw-architect"),
    (re.compile(r"\b(?:development|implementation)\b", re.I), "sw-developer"),
    (re.compile(r"\bdebug(?:ging)?\b", re.I), "debugger"),
    (re.compile(r"\bux writing\b", re.I), "ux-writer"),
    (re.compile(r"\b(?:quality assurance|qa|verification)\b", re.I), "qa-engineer"),
    (re.compile(r"\bsecurity\b", re.I), "security-auditor"),
    (re.compile(r"\baccessibility\b", re.I), "a11y-auditor"),
    (re.compile(r"\bdocumentation\b", re.I), "tech-writer"),
    (re.compile(r"\bcontext preservation\b", re.I), "context-save"),
    (
        re.compile(r"\b(?:release|deployment|signing|notarization)\b", re.I),
        "devops-engineer",
    ),
)


def _phase_id(label: str) -> str:
    for pattern, phase_id in _PHASE_IDS:
        if pattern.search(label):
            return phase_id
    slug = re.sub(r"[^a-z0-9]+", "-", label.lower()).strip("-")
    return f"ledger:{slug or 'phase'}"


def _phase_state(status: str) -> str:
    normalized = status.strip().lower()
    if re.search(r"\b(blocked|failed|error)\b", normalized):
        return "blocked"
    if re.search(
        r"\b(not|never|pending|awaiting|unverified|incomplete|partial|partially)\b",
        normalized,
    ):
        return "pending"
    if re.search(r"\b(running|in progress|active|underway)\b", normalized):
        return "now"
    if re.search(
        r"\b(verified|complete|completed|done|passed|green|approved)\b", normalized
    ):
        return "done"
    return "pending"


def _parse_progress_ledger(markdown: str) -> dict[str, Any]:
    """Turn the durable progress table into a UI-safe project map."""
    lines = markdown.splitlines()
    phases: list[dict[str, str]] = []
    for index in range(len(lines) - 2):
        header = [
            cell.strip().lower() for cell in lines[index].strip().strip("|").split("|")
        ]
        divider = lines[index + 1].strip()
        if "phase" not in header or "status" not in header:
            continue
        if not re.fullmatch(r"\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?", divider):
            continue
        phase_col = header.index("phase")
        status_col = header.index("status")
        evidence_col = header.index("evidence") if "evidence" in header else -1
        for row in lines[index + 2 :]:
            if not row.lstrip().startswith("|"):
                break
            cells = [cell.strip() for cell in row.strip().strip("|").split("|")]
            if max(phase_col, status_col) >= len(cells):
                continue
            label = re.sub(r"[*_`]", "", cells[phase_col]).strip()
            status = re.sub(r"[*_`]", "", cells[status_col]).strip()
            if not label or not status:
                continue
            phases.append({
                "id": _phase_id(label),
                "label": label,
                "status": status,
                "state": _phase_state(status),
                "evidence": cells[evidence_col]
                if 0 <= evidence_col < len(cells)
                else "",
            })
        break
    return {
        "available": bool(phases),
        "source": ".sdlc/progress.md",
        "phases": phases,
    }


def _merge_project_run_state(
    ledger: dict[str, Any], run_state: dict[str, Any], project: Path | None = None
) -> dict[str, Any]:
    """Overlay persisted worker truth onto the project's phase ledger."""
    phases = [dict(phase) for phase in ledger.get("phases", [])]
    by_id = {phase["id"]: phase for phase in phases}
    # Generic Kanban task IDs describe implementation units, not delivery
    # phases. They remain in run_state for recovery and attention, but putting
    # them in the phase map duplicates the Agent Activity/history surfaces.
    task_by_phase = {
        task["phase"]: task
        for task in run_state.get("tasks", [])
        if task.get("phase") and not str(task["phase"]).startswith("job:")
    }
    for phase_id, task in task_by_phase.items():
        phase = by_id.get(phase_id)
        if phase is None:
            phase = {
                "id": phase_id,
                "label": task.get("label") or phase_id,
                "status": "Not started",
                "state": "pending",
                "evidence": "",
            }
            phases.append(phase)
            by_id[phase_id] = phase
        status = task.get("status")
        if task.get("dispatch_issue"):
            phase.update(state="blocked", status="Waiting for an available worker")
        elif status == "running":
            phase.update(state="now", status="Working safely in the background")
        elif status in {"ready", "todo", "scheduled"}:
            phase.update(state="pending", status="Queued safely")
        elif status in {"blocked", "triage"}:
            phase.update(state="blocked", status="Needs your attention")
        elif status == "done":
            phase.update(state="done", status="Reported complete")

    # A ledger can be left saying "running" after an old browser-owned worker
    # vanished. Do not keep presenting that as live work when no saved job owns it.
    for phase in phases:
        if (
            run_state.get("state") != "unavailable"
            and phase.get("state") == "now"
            and phase.get("id") not in task_by_phase
        ):
            phase.update(
                state="blocked",
                status="No active agent — Lyra can safely continue this phase",
            )
    # Job completion is a report, not proof. Never label it "Verified".
    # A missing/unsafe citation keeps the phase out of the completed count.
    for phase in phases:
        if phase.get("state") != "done":
            continue
        citations = evidence_paths(str(phase.get("evidence") or ""))
        raw = str(phase.get("evidence") or "").strip()
        if not citations and raw and not any(char.isspace() for char in raw):
            citations = [raw]
        records = inspect_evidence(project, citations) if project else []
        phase["evidence_checks"] = records
        if not records or any(record["state"] != "available" for record in records):
            phase.update(
                state="pending", status="Reported complete — evidence needs review"
            )
        else:
            phase["status"] = "Reported complete — evidence available"

    return {
        "available": bool(phases),
        "source": (
            "durable-project-jobs"
            if run_state.get("available")
            else ledger.get("source", ".sdlc/progress.md")
        ),
        "updated_at": max(
            int(ledger.get("updated_at_epoch") or 0),
            int(run_state.get("last_activity_at") or 0),
        )
        or None,
        "phases": phases,
    }
