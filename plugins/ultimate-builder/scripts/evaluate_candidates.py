#!/usr/bin/env python3
"""Validate learning candidates without promoting or editing any skill."""

from __future__ import annotations

import argparse
import json
from pathlib import Path


REQUIRED = {
    "schema_version",
    "title",
    "trigger",
    "proposed_change",
    "evidence",
    "source_phase",
    "risk",
    "status",
}
RISKS = {"low", "medium", "high"}


def validate(project: Path) -> list[str]:
    errors: list[str] = []
    root = project.resolve()
    candidates = root / ".sdlc" / "learning-candidates"
    if not candidates.is_dir():
        return [f"No candidate directory: {candidates}"]
    for path in sorted(candidates.glob("*.json")):
        try:
            item = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            errors.append(f"{path.name}: invalid JSON: {exc}")
            continue
        if not isinstance(item, dict):
            errors.append(f"{path.name}: root must be an object")
            continue
        missing = sorted(REQUIRED - item.keys())
        if missing:
            errors.append(f"{path.name}: missing {', '.join(missing)}")
        if item.get("schema_version") != 1:
            errors.append(f"{path.name}: schema_version must be 1")
        if item.get("risk") not in RISKS:
            errors.append(f"{path.name}: risk must be low, medium, or high")
        if item.get("status") != "candidate":
            errors.append(f"{path.name}: status must remain candidate")
        evidence = item.get("evidence")
        if not isinstance(evidence, list) or not evidence:
            errors.append(f"{path.name}: evidence must be a non-empty list")
            continue
        for raw in evidence:
            if not isinstance(raw, str) or not raw:
                errors.append(f"{path.name}: invalid evidence path")
                continue
            resolved = (root / raw).resolve()
            try:
                resolved.relative_to(root)
            except ValueError:
                errors.append(f"{path.name}: evidence escapes project: {raw}")
                continue
            if not resolved.is_file():
                errors.append(f"{path.name}: missing evidence: {raw}")
    return errors


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("project", type=Path)
    args = parser.parse_args()
    errors = validate(args.project)
    if errors:
        print("\n".join(errors))
        return 1
    print("All learning candidates have valid envelopes and evidence paths.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
