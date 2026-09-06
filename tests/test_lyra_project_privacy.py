"""Generated user projects must never become part of a Lyra release."""

from __future__ import annotations

import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PRIVATE_PROJECT_PATHS = ("my_projects", "song-maker-studio")


def test_generated_projects_are_not_tracked() -> None:
    result = subprocess.run(
        ["git", "ls-files", "--", *PRIVATE_PROJECT_PATHS],
        cwd=ROOT,
        capture_output=True,
        check=True,
        text=True,
    )

    assert result.stdout.strip() == "", (
        "Generated project files are private local work and must not be committed:\n"
        f"{result.stdout.strip()}"
    )
