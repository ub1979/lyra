"""Bounded, project-local evidence checks; never execute untrusted reports."""

import hashlib
import re
from pathlib import Path

MAX_EVIDENCE_BYTES = 2 * 1024 * 1024


def evidence_paths(text: str) -> list[str]:
    """Read explicit Markdown/code citations, not filenames guessed from prose."""
    candidates = re.findall(r"`([^`\n]+)`|\[[^\]\n]*\]\(([^)\n]+)\)", text)
    return list(dict.fromkeys(a or b for a, b in candidates))[:100]


def inspect_evidence(project: Path, references: list[str]) -> list[dict]:
    """Hash readable local files. Availability does not prove a claim is true."""
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
                            state="available", sha256=hashlib.sha256(data).hexdigest()
                        )
            except (OSError, RuntimeError):
                record["state"] = "unreadable"
        records.append(record)
    return records
