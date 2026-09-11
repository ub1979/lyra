"""Non-destructive reconciliation for Ultimate Builder project learnings."""

from __future__ import annotations

import hashlib
import json
import os
import stat
import tempfile
import time
from contextlib import contextmanager
from pathlib import Path
from typing import Any


_LEARNING_LIMIT_BYTES = 4 * 1024 * 1024


def _bounded_lines(path: Path) -> tuple[list[str], str | None]:
    try:
        if path.is_symlink() or path.stat().st_size > _LEARNING_LIMIT_BYTES:
            return [], "unsafe_or_oversized"
        return path.read_text(encoding="utf-8").splitlines(), None
    except (OSError, UnicodeError):
        return [], "unreadable"


def _legacy_learning(raw: dict[str, Any], project_name: str) -> dict[str, Any]:
    encoded = json.dumps(raw, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    fingerprint = hashlib.sha256(encoded.encode("utf-8")).hexdigest()
    bug = str(raw.get("bug") or "").strip()
    pattern = str(raw.get("pattern") or "").strip()
    lesson = str(raw.get("lesson") or "").strip()
    summary = bug or lesson or pattern or "Imported debugging lesson"
    details = []
    for label, key in (
        ("Root cause", "root_cause"),
        ("Trigger", "trigger"),
        ("Fix", "fix"),
        ("Lesson", "lesson"),
    ):
        value = str(raw.get(key) or "").strip()
        if value:
            details.append(f"{label}: {value}")
    files = raw.get("files")
    if not isinstance(files, list):
        files = []
    return {
        "date": str(raw.get("date") or "").strip(),
        "project": project_name,
        "category": "pitfall",
        "summary": summary,
        "detail": " ".join(details) or summary,
        "files": [str(item) for item in files if isinstance(item, str)],
        "tags": [item for item in ("debugging", pattern.lower()) if item],
        "source": ".sdlc/debug-learnings.jsonl",
        "source_sha256": fingerprint,
    }


@contextmanager
def _exclusive_learning_lock(path: Path, timeout_seconds: float = 5.0):
    """Serialize cross-process reconciliation without an unbounded wait."""
    deadline = time.monotonic() + timeout_seconds
    flags = os.O_CREAT | os.O_RDWR
    if hasattr(os, "O_NOFOLLOW"):
        flags |= os.O_NOFOLLOW
    descriptor = os.open(path, flags, 0o600)
    with os.fdopen(descriptor, "a+b") as lock_file:
        metadata = os.fstat(lock_file.fileno())
        if not stat.S_ISREG(metadata.st_mode):
            raise OSError("learning reconciliation lock is not a regular file")
        if hasattr(os, "getuid") and metadata.st_uid != os.getuid():
            raise OSError("learning reconciliation lock has an unexpected owner")
        if os.name == "nt" and metadata.st_size == 0:
            lock_file.write(b"0")
            lock_file.flush()
        while True:
            try:
                if os.name == "nt":
                    import msvcrt

                    lock_file.seek(0)
                    msvcrt.locking(lock_file.fileno(), msvcrt.LK_NBLCK, 1)
                else:
                    import fcntl

                    fcntl.flock(lock_file.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
                break
            except OSError:
                if time.monotonic() >= deadline:
                    raise TimeoutError("learning reconciliation lock timed out")
                time.sleep(0.05)
        try:
            yield
        finally:
            if os.name == "nt":
                lock_file.seek(0)
                msvcrt.locking(lock_file.fileno(), msvcrt.LK_UNLCK, 1)
            else:
                fcntl.flock(lock_file.fileno(), fcntl.LOCK_UN)


def _reconcile_locked(
    root: Path, sdlc: Path, legacy: Path, canonical: Path
) -> dict[str, Any]:
    legacy_lines, legacy_error = _bounded_lines(legacy)
    canonical_lines, canonical_error = (
        _bounded_lines(canonical) if canonical.exists() else ([], None)
    )
    if legacy_error or canonical_error:
        return {
            "ok": False,
            "imported": 0,
            "skipped": 0,
            "error": legacy_error or canonical_error,
        }

    seen: set[str] = set()
    for line in canonical_lines:
        try:
            item = json.loads(line)
        except json.JSONDecodeError:
            continue
        if isinstance(item, dict) and isinstance(item.get("source_sha256"), str):
            seen.add(item["source_sha256"])

    additions: list[dict[str, Any]] = []
    skipped = 0
    for line in legacy_lines:
        try:
            raw = json.loads(line)
        except json.JSONDecodeError:
            skipped += 1
            continue
        if not isinstance(raw, dict):
            skipped += 1
            continue
        entry = _legacy_learning(raw, root.name)
        if entry["source_sha256"] in seen:
            continue
        seen.add(entry["source_sha256"])
        additions.append(entry)

    if additions:
        existing = canonical.read_bytes() if canonical.exists() else b""
        if existing and not existing.endswith(b"\n"):
            existing += b"\n"
        payload = existing + "".join(
            json.dumps(item, ensure_ascii=False, sort_keys=True) + "\n"
            for item in additions
        ).encode("utf-8")
        descriptor, temporary_name = tempfile.mkstemp(
            prefix=".learnings-", suffix=".tmp", dir=sdlc
        )
        temporary = Path(temporary_name)
        try:
            with os.fdopen(descriptor, "wb") as stream:
                stream.write(payload)
                stream.flush()
                os.fsync(stream.fileno())
            os.replace(temporary, canonical)
        finally:
            temporary.unlink(missing_ok=True)
    return {
        "ok": True,
        "imported": len(additions),
        "skipped": skipped,
        "legacy": True,
        "canonical": ".sdlc/learnings.jsonl",
        "legacy_retained": ".sdlc/debug-learnings.jsonl",
    }


def reconcile_legacy_debug_learnings(project: str | Path) -> dict[str, Any]:
    """Import unseen legacy debug entries into the canonical log, never delete."""
    root = Path(project).expanduser().resolve(strict=False)
    sdlc = root / ".sdlc"
    legacy = sdlc / "debug-learnings.jsonl"
    canonical = sdlc / "learnings.jsonl"
    if not legacy.is_file():
        return {"ok": True, "imported": 0, "skipped": 0, "legacy": False}
    if sdlc.is_symlink() or not sdlc.resolve(strict=False).is_relative_to(root):
        return {
            "ok": False,
            "imported": 0,
            "skipped": 0,
            "error": "unsafe .sdlc directory",
        }
    lock_name = hashlib.sha256(str(root).encode("utf-8")).hexdigest()
    lock_path = Path(tempfile.gettempdir()) / f"lyra-learning-{lock_name}.lock"
    try:
        with _exclusive_learning_lock(lock_path):
            return _reconcile_locked(root, sdlc, legacy, canonical)
    except (OSError, TimeoutError) as exc:
        return {
            "ok": False,
            "imported": 0,
            "skipped": 0,
            "error": str(exc) or "learning reconciliation lock failed",
        }
