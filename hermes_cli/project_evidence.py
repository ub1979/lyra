"""Bounded, project-local evidence checks for Project Brain references."""

from __future__ import annotations

import hashlib
import re
from pathlib import Path


MAX_EVIDENCE_BYTES = 2 * 1024 * 1024


def evidence_paths(text: str) -> list[str]:
    """Return explicit Markdown and inline-code paths without guessing."""
    candidates = re.findall(r"`([^`\n]+)`|\[[^\]\n]*\]\(([^)\n]+)\)", text)
    return list(dict.fromkeys(left or right for left, right in candidates))[:100]


def inspect_evidence(project: Path, references: list[str]) -> list[dict]:
    """Check and fingerprint readable project-local evidence files."""
    root = project.resolve()
    records = []
    for reference in references[:100]:
        name = reference.split("#", 1)[0]
        record = {"path": reference, "state": "missing", "sha256": None}
        candidate = Path(name)
        if not name or candidate.is_absolute() or ":" in name:
            record["state"] = "outside_project"
        else:
            candidate = root / candidate
            try:
                if not candidate.resolve().is_relative_to(root):
                    record["state"] = "outside_project"
                elif candidate.is_file():
                    with candidate.open("rb") as stream:
                        data = stream.read(MAX_EVIDENCE_BYTES + 1)
                    if len(data) > MAX_EVIDENCE_BYTES:
                        record["state"] = "too_large"
                    else:
                        record.update(
                            state="available",
                            sha256=hashlib.sha256(data).hexdigest(),
                        )
            except (OSError, RuntimeError):
                record["state"] = "unreadable"
        records.append(record)
    return records
