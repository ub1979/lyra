"""Load bounded project work units for the existing Kanban dependency queue."""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any


_TASK_HEADING = re.compile(
    r"^#{2,6}\s+([A-Z][A-Z0-9_-]*-\d{1,4})\s*(?:—|–|-|:)\s*(.+?)\s*$",
    re.M,
)
_DEPENDENCY_LINE = re.compile(r"^\s*\*\*Depends on:\*\*\s*(.*?)\s*$", re.I | re.M)
_TASK_ID = re.compile(r"\b[A-Z][A-Z0-9_-]*-\d{1,4}\b")
_VERDICT = re.compile(r"\b(ACCEPTED|REJECTED)\b", re.I)
_GRAPH_LOCATIONS = (Path("task-graph.md"), Path(".sdlc/task-graph.md"))
MAX_WORK_UNITS = 120


def load_qa_work_units(build_profile: str | None = None) -> dict[str, Any]:
    """Small QA stages on the existing dependency scheduler, not a new swarm.

    These jobs share a project directory, so dependencies serialize writers.
    A completed board job, not a stale evidence-file keyword, authorizes reuse.
    """
    if build_profile == "personal":
        return {
            "source": "ultimate-builder:qa-engineer personal smoke contract",
            "units": [{
                "id": "QA-MVP-001",
                "title": "Verify the approved MVP in one smoke pass",
                "section": (
                    "Set up the existing application and test runner with isolated data. "
                    "Run the project's automated checks and exercise every approved core "
                    "acceptance criterion through the real entry point; use a real browser "
                    "for UI apps. Check saved data after reload, a relevant failure path, "
                    "console errors and keyboard access. Record exact commands, outputs, "
                    "revision, untested areas and risks in bug-report.md and task evidence. "
                    "Block on serious defects or required untested work; send bounded repair "
                    "and retest needs to Development. Only verified core behavior permits "
                    "a QA phase verdict. Do not expand into production readiness work."
                ),
                "parents": [], "accepted": False, "final": True,
            }],
        }
    stages = [
        ("QA-001", "Prepare reproducible QA environment",
         "Inventory applicable acceptance criteria and existing tests. Reuse the "
         "project's runner; if existing tests already run the real entry point "
         "with suitable isolation, use that command as the smoke gate and record "
         "its output. Do not create or test a wrapper harness just for this stage. "
         "Only fill a demonstrated setup gap. Establish one smoke command with isolated "
         "temporary data/config, readiness checks, free ports and owned-process "
         "cleanup. Prove setup works. Record commands, revision and limitations. "
         "Do not execute the full QA campaign or repair product features here."),
        ("QA-002", "Execute functional and boundary checks",
         "Use QA-001's runner and setup; do not rebuild them without evidence they "
         "are broken. Execute automated/API/data/CLI checks applicable to this app, "
         "including repeated Start, cancellation, limits and failure behavior. "
         "Record exact commands, outputs and revision. Record product defects for "
         "a bounded developer repair; do not absorb an implementation project."),
        ("QA-003", "Verify user journeys and integrations",
         "Reuse setup and QA-002 evidence. Exercise real user journeys (browser "
         "for UI apps), reload/restart and saved data. Run bounded external-provider "
         "smokes only within existing user authority and cost limits. Label mock "
         "integration evidence separately from real-provider evidence. For a "
         "non-UI app use its real CLI/library entry points. Record failures and "
         "untested areas; do not claim that unavailable checks passed."),
        ("QA-004", "Assemble acceptance verdict and handoff",
         "Inspect all stage evidence against the current revision and dirty files. "
         "Rerun checks invalidated by code changes, not the entire bootstrap. "
         "Write bug-report.md, exact run instructions and remaining risks. Update "
         "the Project Brain and progress ledger. Only this final QA stage may mark "
         "the phase verified, with applicable acceptance criteria actually met. "
         "Open serious defects or required untested areas mean block with exact "
         "bounded repair/retest requirements, not approval. Save the scoped handoff."),
    ]
    units = []
    for index, (unit_id, title, section) in enumerate(stages):
        units.append({
            "id": unit_id, "title": title, "section": section,
            "parents": [stages[index - 1][0]] if index else [],
            "accepted": False,
            "final": unit_id == "QA-004",
        })
    return {"source": "ultimate-builder:qa-engineer bounded QA contract", "units": units}


def _task_graph_path(project: Path) -> Path | None:
    for relative in _GRAPH_LOCATIONS:
        candidate = project / relative
        if candidate.is_file():
            return candidate
    return None


def _latest_evidence_verdict(project: Path, unit_id: str) -> str | None:
    """Return the last explicit verdict for the unit's canonical evidence."""
    evidence = project / ".sdlc" / "evidence" / "tasks" / f"{unit_id}.txt"
    try:
        matches = _VERDICT.findall(evidence.read_text(encoding="utf-8"))
    except OSError:
        return None
    return matches[-1].upper() if matches else None


def _order_by_dependencies(units: list[dict[str, Any]]) -> list[dict[str, Any]]:
    known = {str(unit["id"]) for unit in units}
    for unit in units:
        unknown = set(unit["parents"]).difference(known)
        if unknown:
            names = ", ".join(sorted(unknown))
            raise ValueError(f"{unit['id']} depends on unknown task(s): {names}")

    visiting: set[str] = set()
    visited: set[str] = set()
    ordered: list[str] = []
    parents = {str(unit["id"]): tuple(unit["parents"]) for unit in units}

    def visit(unit_id: str) -> None:
        if unit_id in visited:
            return
        if unit_id in visiting:
            raise ValueError("Task graph contains a dependency cycle")
        visiting.add(unit_id)
        for parent in parents[unit_id]:
            visit(parent)
        visiting.remove(unit_id)
        visited.add(unit_id)
        ordered.append(unit_id)

    for unit_id in parents:
        visit(unit_id)
    by_id = {str(unit["id"]): unit for unit in units}
    return [by_id[unit_id] for unit_id in ordered]


def load_development_work_units(project: Path) -> dict[str, Any]:
    """Parse independently verifiable jobs without interpreting project prose.

    The task-planner contract gives every work item a heading and a ``Depends
    on`` field. Those structural markers are intentionally the only inputs to
    scheduling; an LLM is not asked to estimate scope again at dispatch time.
    """
    graph = _task_graph_path(project)
    if graph is None:
        return {"source": None, "units": []}
    markdown = graph.read_text(encoding="utf-8")
    matches = list(_TASK_HEADING.finditer(markdown))
    if len(matches) < 2:
        return {"source": str(graph.relative_to(project)), "units": []}
    if len(matches) > MAX_WORK_UNITS:
        raise ValueError(
            f"Task graph has {len(matches)} work items; maximum is {MAX_WORK_UNITS}"
        )

    units: list[dict[str, Any]] = []
    seen: set[str] = set()
    for index, match in enumerate(matches):
        unit_id = match.group(1).upper()
        if unit_id in seen:
            raise ValueError(f"Task graph repeats work item {unit_id}")
        seen.add(unit_id)
        end = matches[index + 1].start() if index + 1 < len(matches) else len(markdown)
        section = markdown[match.start():end].strip()
        dependency = _DEPENDENCY_LINE.search(section)
        parent_ids = []
        if dependency:
            parent_ids = [item.upper() for item in _TASK_ID.findall(dependency.group(1))]
        units.append(
            {
                "id": unit_id,
                "title": match.group(2).strip(),
                "section": section,
                "parents": parent_ids,
                "accepted": _latest_evidence_verdict(project, unit_id) == "ACCEPTED",
            }
        )

    units = _order_by_dependencies(units)
    return {"source": str(graph.relative_to(project)), "units": units}
