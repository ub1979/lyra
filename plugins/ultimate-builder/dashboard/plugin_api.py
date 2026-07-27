"""Read-only dashboard API for Ultimate Builder project state."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException, Query


router = APIRouter()
_ARTIFACTS = (
    "requirements.md",
    "mvp-brief.md",
    "plan.md",
    "task-graph.md",
    "project-plan.md",
    "review-report.md",
    "bug-report.md",
    "security-report.md",
    "benchmark-report.md",
    "DEPLOYMENT.md",
    "README.md",
    ".sdlc/debt.md",
    ".sdlc/preview/index.html",
)


def _project(path: str) -> Path:
    candidate = Path(path).expanduser().resolve()
    if not candidate.is_dir():
        raise HTTPException(status_code=404, detail="Project directory not found")
    return candidate


def _safe_text(path: Path, limit: int = 120_000) -> str:
    try:
        data = path.read_text(encoding="utf-8")
    except (OSError, UnicodeError):
        return ""
    return data[:limit]


@router.get("/state")
def state(path: str = Query(..., min_length=1)) -> dict[str, Any]:
    project = _project(path)
    sdlc = project / ".sdlc"
    progress = sdlc / "progress.md"
    artifacts = []
    for name in _ARTIFACTS:
        item = project / name
        artifacts.append(
            {
                "name": name,
                "exists": item.is_file(),
                "bytes": item.stat().st_size if item.is_file() else 0,
            }
        )

    candidates = []
    candidate_dir = sdlc / "learning-candidates"
    if candidate_dir.is_dir():
        for item in sorted(candidate_dir.glob("*.json"))[:100]:
            try:
                value = json.loads(_safe_text(item, 64_000))
                if isinstance(value, dict):
                    candidates.append(
                        {
                            "file": item.name,
                            "title": str(value.get("title", item.stem)),
                            "risk": str(value.get("risk", "unknown")),
                            "status": str(value.get("status", "candidate")),
                        }
                    )
            except json.JSONDecodeError:
                candidates.append(
                    {
                        "file": item.name,
                        "title": item.stem,
                        "risk": "unknown",
                        "status": "invalid",
                    }
                )

    return {
        "project": str(project),
        "has_sdlc": sdlc.is_dir(),
        "progress": _safe_text(progress),
        "artifacts": artifacts,
        "learning_candidates": candidates,
    }
