"""Fingerprint the visual preview a user is asked to approve.

An approval is only meaningful for the exact preview the user saw. The digest
covers every file under the playbook's canonical preview folder, so editing,
adding or removing any preview file produces a different value and an older
approval no longer matches.
"""

from __future__ import annotations

import hashlib
from pathlib import Path

PREVIEW_DIR = Path(".sdlc") / "preview"
# A preview is a handful of static mockups. The cap keeps a runaway folder
# from turning a queue check into a long hash of unrelated build output.
_MAX_FILES = 200


def preview_digest(project: Path) -> str | None:
    """Return a stable digest of the preview files, or None when there are none."""
    root = Path(project) / PREVIEW_DIR
    if root.parent.is_symlink() or root.is_symlink():
        raise ValueError("Preview approval cannot follow symlinks; copy preview files into .sdlc/preview.")
    if not root.is_dir():
        return None
    files = []
    for path in root.rglob("*"):
        if path.is_symlink():
            raise ValueError("Preview approval cannot follow symlinks; copy linked assets into the preview.")
        if path.is_file():
            files.append(path)
            if len(files) > _MAX_FILES:
                raise ValueError(f"Preview approval supports at most {_MAX_FILES} files; remove build output first.")
    files.sort()
    if not files:
        return None
    digest = hashlib.sha256()
    for path in files:
        # Include the relative path so moving content between files counts
        # as a change, and separate fields so boundaries cannot collide.
        digest.update(path.relative_to(root).as_posix().encode("utf-8"))
        digest.update(b"\0")
        digest.update(path.read_bytes())
        digest.update(b"\0")
    return digest.hexdigest()
