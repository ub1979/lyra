"""Persist one preview checkpoint record per project workspace.

Records live under ``<HERMES_HOME>/app-state/``. The agent's file tools refuse
writes there (see ``agent/file_safety.py``), so a coordinator cannot create an
approval by writing a file. This is an application boundary like ``state.db``,
not an operating-system sandbox.
"""

from __future__ import annotations

import hashlib
import json
import threading
from pathlib import Path
from typing import Any

_lock = threading.Lock()
_SCHEMA_VERSION = 1


def _store_root() -> Path:
    from hermes_constants import get_hermes_home

    return get_hermes_home() / "app-state" / "ultimate-builder" / "preview-checkpoints"


def _record_path(project: Path) -> Path:
    key = hashlib.sha256(str(Path(project).resolve()).encode("utf-8")).hexdigest()[:24]
    return _store_root() / f"{key}.json"


def load_checkpoint(project: Path) -> dict[str, Any] | None:
    """Return the saved record for this exact workspace, or None."""
    path = _record_path(project)
    try:
        record = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    if not isinstance(record, dict) or record.get("schema_version") != _SCHEMA_VERSION:
        return None
    # A record copied from another workspace must never authorize this one.
    if record.get("workspace") != str(Path(project).resolve()):
        return None
    return record


def save_checkpoint(project: Path, record: dict[str, Any]) -> None:
    """Atomically replace this workspace's record."""
    from utils import atomic_json_write

    payload = dict(record)
    payload["schema_version"] = _SCHEMA_VERSION
    payload["workspace"] = str(Path(project).resolve())
    with _lock:
        atomic_json_write(_record_path(project), payload)


def find_open_checkpoint(question: str) -> tuple[Path, dict[str, Any]] | None:
    """Find the pending record whose backend-written question matches exactly."""
    root = _store_root()
    if not root.is_dir():
        return None
    for path in root.glob("*.json"):
        try:
            record = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            continue
        if (
            isinstance(record, dict)
            and record.get("status") == "pending"
            and record.get("question") == question
        ):
            return Path(str(record.get("workspace") or "")), record
    return None
