"""Create the project progress ledger from Lyra's supported format.

Trial 3's Development worker spent 12 of its 90 calls searching Lyra's source
and another project to learn this format. The table columns and status words
below are exactly what ``project_progress._parse_progress_ledger`` reads.
"""

from __future__ import annotations

import os
from pathlib import Path

LEDGER_RELATIVE_PATH = Path(".sdlc") / "progress.md"

# Status words the parser understands, in the order a phase moves through them.
STATUS_WORDS = ("pending", "running", "blocked", "verified")

LEDGER_EXAMPLE_ROW = "| Development | running | .sdlc/evidence/tasks/DEV-1.txt |"

LEDGER_TEMPLATE = """# Project progress

Lyra reads the table below. Keep one row per phase and update its Status and
Evidence in place. Status words: pending, running, blocked, verified.
Evidence is a project-relative path to a saved report or test output.

| Phase | Status | Evidence |
|---|---|---|
"""


def ensure_progress_ledger(project: Path) -> bool:
    """Create ``.sdlc/progress.md`` from the template if it does not exist.

    Never overwrites an existing ledger and never writes through a symlinked
    ``.sdlc`` folder. Returns True only when this call created the file.
    """
    sdlc = Path(project) / ".sdlc"
    if sdlc.is_symlink():
        return False
    sdlc.mkdir(parents=True, exist_ok=True)
    path = Path(project) / LEDGER_RELATIVE_PATH
    try:
        # O_EXCL: a ledger created by a worker at the same moment wins.
        fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o644)
    except FileExistsError:
        return False
    with os.fdopen(fd, "w", encoding="utf-8") as stream:
        stream.write(LEDGER_TEMPLATE)
    return True
