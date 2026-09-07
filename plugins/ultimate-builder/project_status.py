"""Maintain Lyra's small, validated project-status projection."""

from __future__ import annotations

import json
import os
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable


STATUS_SCHEMA_VERSION = 1
STATUS_RELATIVE_PATH = ".sdlc/status.json"
_MAX_STATUS_BYTES = 64 * 1024
_MAX_LEDGER_BYTES = 512 * 1024
_MAX_PHASES = 96
_VALID_STATES = frozenset({"done", "now", "pending", "blocked"})


def _source_signature(progress: Path) -> dict[str, int | bool]:
    try:
        stat = progress.stat()
    except OSError:
        return {"exists": False, "mtime_ns": 0, "bytes": 0}
    return {
        "exists": progress.is_file() and not progress.is_symlink(),
        "mtime_ns": int(stat.st_mtime_ns),
        "bytes": int(stat.st_size),
    }


def _utc_iso(epoch_seconds: float | int | None) -> str | None:
    if epoch_seconds is None:
        return None
    return datetime.fromtimestamp(float(epoch_seconds), timezone.utc).isoformat()


def _short(value: Any, limit: int) -> str:
    return str(value or "").strip()[:limit]


def _sanitize_phases(phases: Any) -> list[dict[str, str]]:
    if not isinstance(phases, list):
        return []
    clean: list[dict[str, str]] = []
    for phase in phases[:_MAX_PHASES]:
        if not isinstance(phase, dict):
            continue
        phase_id = _short(phase.get("id"), 128)
        label = _short(phase.get("label"), 200)
        state = _short(phase.get("state"), 20)
        if not phase_id or not label or state not in _VALID_STATES:
            continue
        clean.append({
            "id": phase_id,
            "label": label,
            "status": _short(phase.get("status"), 320),
            "state": state,
            "evidence": _short(phase.get("evidence"), 512),
        })
    return clean


def _build_snapshot(
    ledger: dict[str, Any], signature: dict[str, int | bool]
) -> dict[str, Any]:
    phases = _sanitize_phases(ledger.get("phases"))
    source_epoch = (
        int(signature["mtime_ns"]) / 1_000_000_000 if signature.get("exists") else None
    )
    return {
        "schema_version": STATUS_SCHEMA_VERSION,
        "source": ".sdlc/progress.md",
        "source_signature": signature,
        "updated_at": _utc_iso(source_epoch),
        "updated_at_epoch": int(source_epoch) if source_epoch is not None else None,
        "available": bool(phases),
        "summary": {
            "done": sum(phase["state"] == "done" for phase in phases),
            "open": sum(phase["state"] != "done" for phase in phases),
            "blocked": sum(phase["state"] == "blocked" for phase in phases),
            "active": sum(phase["state"] == "now" for phase in phases),
        },
        "phases": phases,
    }


def _read_snapshot(status_path: Path) -> dict[str, Any] | None:
    try:
        if status_path.is_symlink() or status_path.stat().st_size > _MAX_STATUS_BYTES:
            return None
        value = json.loads(status_path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError, TypeError, ValueError):
        return None
    if (
        not isinstance(value, dict)
        or value.get("schema_version") != STATUS_SCHEMA_VERSION
    ):
        return None
    phases = _sanitize_phases(value.get("phases"))
    if phases != value.get("phases"):
        return None
    signature = value.get("source_signature")
    if (
        not isinstance(signature, dict)
        or type(signature.get("exists")) is not bool
        or type(signature.get("mtime_ns")) is not int
        or type(signature.get("bytes")) is not int
        or signature["mtime_ns"] < 0
        or signature["bytes"] < 0
    ):
        return None
    # Recompute every derived field. A manually damaged summary or available
    # flag must never turn an empty/pending snapshot into reported completion.
    return _build_snapshot({"phases": phases}, signature)


def _atomic_write(status_path: Path, snapshot: dict[str, Any]) -> bool:
    sdlc = status_path.parent
    project = sdlc.parent.resolve(strict=False)
    try:
        sdlc.mkdir(parents=True, exist_ok=True)
        if sdlc.is_symlink() or sdlc.resolve(strict=False).parent != project:
            return False
        payload = json.dumps(snapshot, ensure_ascii=False, indent=2) + "\n"
        if len(payload.encode("utf-8")) > _MAX_STATUS_BYTES:
            return False
        descriptor, temporary_name = tempfile.mkstemp(
            prefix=".status-", suffix=".tmp", dir=sdlc
        )
        temporary = Path(temporary_name)
        try:
            with os.fdopen(descriptor, "w", encoding="utf-8") as stream:
                stream.write(payload)
                stream.flush()
                os.fsync(stream.fileno())
            os.replace(temporary, status_path)
        finally:
            temporary.unlink(missing_ok=True)
        return True
    except OSError:
        return False


def load_project_status(
    project: str | Path,
    parse_progress: Callable[[str], dict[str, Any]],
) -> dict[str, Any]:
    """Return current compact status, rebuilding only when the ledger changed."""
    root = Path(project).expanduser().resolve(strict=False)
    sdlc = root / ".sdlc"
    status_path = root / STATUS_RELATIVE_PATH
    if sdlc.is_symlink():
        return {
            **_build_snapshot(parse_progress(""), _source_signature(root / "missing")),
            "cache": "memory",
        }
    progress = sdlc / "progress.md"
    signature = _source_signature(progress)
    cached = _read_snapshot(status_path)
    if cached is not None and cached.get("source_signature") == signature:
        return {**cached, "cache": "hit"}

    text = ""
    if signature.get("exists"):
        try:
            with progress.open("r", encoding="utf-8") as stream:
                text = stream.read(_MAX_LEDGER_BYTES)
        except (OSError, UnicodeError):
            text = ""
    snapshot = _build_snapshot(parse_progress(text), signature)
    persisted = _atomic_write(status_path, snapshot)
    return {**snapshot, "cache": "refreshed" if persisted else "memory"}
