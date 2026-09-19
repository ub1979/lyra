"""Read-only coverage checks for newly queued, focused QA campaigns.

This checks a reported acceptance matrix, not whether tests really ran or the
product is correct. Kanban completion/dependency semantics stay in Hermes.
"""

from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path

from hermes_cli.project_evidence import inspect_evidence

_MARKER = "Lyra QA coverage contract: "
_MAX_BYTES = 256 * 1024
_MAX_CRITERIA = 256


def _read(project: Path, relative: str) -> bytes:
    path = project / relative
    if Path(relative).is_absolute() or not path.resolve().is_relative_to(project.resolve()):
        raise ValueError("QA evidence must remain inside this project")
    with path.open("rb") as stream:
        data = stream.read(_MAX_BYTES + 1)
    if len(data) > _MAX_BYTES:
        raise ValueError("QA coverage input exceeds 256 KiB")
    return data


def _criteria(markdown: str) -> list[str]:
    """Read explicit ID/requirement tables, not references in narrative prose.

    Unknown requirements formats remain a review item rather than silently
    producing an empty, allegedly passing matrix.
    """
    found = []
    id_column = None
    for line in markdown.splitlines():
        if not line.lstrip().startswith("|"):
            id_column = None
            continue
        cells = [cell.strip().strip("`* ") for cell in line.strip().strip("|").split("|")]
        header = [cell.lower() for cell in cells]
        if "id" in header and any("requirement" in cell or "criterion" in cell for cell in header):
            id_column = header.index("id")
        elif id_column is not None and len(cells) > id_column:
            value = cells[id_column]
            if re.fullmatch(r"[A-Z][A-Z0-9_-]{0,30}-[0-9]{1,6}", value):
                found.append(value)
    if len(found) != len(set(found)) or len(found) > _MAX_CRITERIA:
        return []
    return found


def final_instructions(project: Path, run_token: str) -> str:
    """Pin inputs in the existing immutable job body; no separate state store."""
    try:
        data = _read(project, "requirements.md")
        digest = hashlib.sha256(data).hexdigest()
        criteria = _criteria(data.decode("utf-8"))
    except (OSError, ValueError, UnicodeError, RuntimeError):
        digest, criteria = None, []
    contract = {
        "requirements_sha256": digest,
        "criteria": criteria,
        "report": f".sdlc/qa-acceptance-{run_token}.json",
    }
    return (
        "\nFinal QA coverage handoff (only after the selected scopes finish):\n"
        + _MARKER + json.dumps(contract, separators=(",", ":"))
        + '\nWrite the named JSON report with this shape: '
        '{"requirements_sha256":"copy the pinned digest",'
        '"tested_revision":"actual revision and dirty-file notes",'
        '"results":[{"id":"each pinned criterion", "status":"PASS|FAIL|BLOCKED",'
        '"evidence":["project-relative raw evidence file"]}]}.'
        "\nAccount for every pinned criterion, including explicit requirements normally "
        "outside this profile. Do not mark untested/omitted checks PASS. Reuse valid "
        "evidence across scopes. A readable file is not proof that its claim is true. "
        "If criteria are empty or inputs changed, report needs-review and the exact "
        "missing requirement mapping; do not invent approval or rewrite requirements. "
        "The coordinator must resolve this and queue a fresh QA pass if needed. "
        "Job completion alone does not establish project acceptance.\n"
    )


def _review(report: str, issues: list[str]) -> dict:
    return {
        "status": "needs_review",
        "summary": "QA work finished — acceptance coverage needs review",
        "report": report,
        "issues": issues[:12],
        "recovery": (
            "Inspect the named gaps. Preserve valid evidence, resolve failures or "
            "missing decisions, then queue qa-engineer with force_new=true for a "
            "bounded recheck. Do not automatically retry or claim project approval."
        ),
    }


def _assess(project: Path, contract: dict) -> dict:
    report_path = contract.get("report", "")
    expected = contract.get("criteria")
    if (not isinstance(expected, list) or not 1 <= len(expected) <= _MAX_CRITERIA
            or not all(isinstance(key, str) and len(key) <= 38 for key in expected)):
        return _review(report_path, ["No unambiguous requirement ID table was captured; human review needed."])
    try:
        current = hashlib.sha256(_read(project, "requirements.md")).hexdigest()
        if current != contract.get("requirements_sha256"):
            return _review(report_path, ["Requirements changed after this QA job was queued."])
        report = json.loads(_read(project, report_path))
        if not isinstance(report, dict) or report.get("requirements_sha256") != current:
            return _review(report_path, ["Coverage report does not match the pinned requirements."])
        rows = report.get("results")
        if not isinstance(rows, list) or len(rows) > _MAX_CRITERIA:
            return _review(report_path, ["Missing or malformed criterion results."])
        issues = []
        if not isinstance(report.get("tested_revision"), str) or not report["tested_revision"].strip():
            issues.append("Tested revision/dirty-file notes are missing.")
        mapped = {}
        for row in rows:
            if not isinstance(row, dict) or not isinstance(row.get("id"), str):
                issues.append("Malformed criterion result.")
                continue
            key = row["id"]
            if key in mapped or key not in expected:
                issues.append("Duplicate or unrecognized criterion result.")
            mapped[key] = row
        # A shared raw log is usually cited by many criteria. Inspect it once
        # per status read, with a bounded unique-file count, not once per row.
        path_checks = {}
        for key in expected:
            row = mapped.get(key, {})
            if row.get("status") != "PASS":
                issues.append(f"{key}: missing, failed, or untested; not a PASS.")
                continue
            paths = row.get("evidence")
            if (not isinstance(paths, list) or not 1 <= len(paths) <= 10
                    or not all(isinstance(path, str) and 0 < len(path) <= 512 for path in paths)):
                issues.append(f"{key}: missing or invalid evidence paths.")
                continue
            for path in paths:
                if path not in path_checks:
                    path_checks[path] = (
                        inspect_evidence(project, [path])[0]["state"]
                        if len(path_checks) < 32 else "too_many_evidence_files"
                    )
            if any(path_checks[path] != "available" for path in paths):
                issues.append(f"{key}: evidence is unavailable or outside this project.")
        if issues:
            return _review(report_path, issues)
        return {
            "status": "reported_complete",
            "summary": "QA coverage reported complete — evidence available, not independent approval",
            "report": report_path,
            "criteria_count": len(expected),
            "tested_revision": report["tested_revision"][:256],
        }
    except (OSError, ValueError, TypeError, UnicodeError, RuntimeError):
        return _review(report_path, ["Coverage report or requirements are missing, unreadable, or malformed."])


def acceptance_state(project: Path, qa_tasks: list) -> dict | None:
    """Only new final jobs carry a contract. Old jobs keep their saved semantics."""
    finals = [task for task in qa_tasks if _MARKER in (task.body or "")]
    if not finals:
        return None
    final = max(finals, key=lambda task: task.created_at)
    # Do not prevent Functional completion from releasing Experience. This is
    # a display/reporting overlay, never a scheduler or terminal-write veto.
    if any(task.status not in {"done", "archived"} for task in qa_tasks):
        return {"status": "in_progress", "summary": "Selected QA work has not finished"}
    if any(task.status == "archived" for task in qa_tasks):
        return _review("", ["Selected QA work was stopped, not completed."])
    try:
        line = next(line for line in final.body.splitlines() if line.startswith(_MARKER))
        contract = json.loads(line[len(_MARKER):])
        if not isinstance(contract, dict):
            raise ValueError("Invalid contract")
        return _assess(project, contract)
    except (StopIteration, ValueError, TypeError):
        return _review("", ["Saved QA coverage contract is malformed."])
