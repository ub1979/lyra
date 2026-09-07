"""Load bounded development work units from a project's task graph."""

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
