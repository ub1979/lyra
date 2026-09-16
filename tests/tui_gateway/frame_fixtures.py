"""Commit real gateway frames so the browser's event fold is tested against them.

The JS test job has no Python, so the frames a journey test captures from
``tui_gateway.server._real_stdout`` are normalised and written to
``tests/fixtures/studio_frames/<name>.jsonl``. Vitest replays them through the
Studio event reducer. Without ``LYRA_WRITE_FRAME_FIXTURES=1`` the journey
asserts the committed event sequence still matches what the gateway emits, so
a protocol change fails loudly with a regeneration hint instead of drifting.
"""

from __future__ import annotations

import json
import os
import re
from pathlib import Path
from typing import Any, Iterable

ROOT = Path(__file__).resolve().parents[2]
FIXTURE_DIR = ROOT / "tests" / "fixtures" / "studio_frames"
REGENERATE_ENV = "LYRA_WRITE_FRAME_FIXTURES"

_VOLATILE_KEY = re.compile(
    r"(^|_)(id|at|cursor|pid|token|ts|time|seconds)$|^(workspace_path|path|model)$"
)
_PATH_MARKERS = ("/private/", "/tmp/", "/Users/", "/home/")


def _scrub(value: Any) -> Any:
    if isinstance(value, dict):
        return {
            key: ("<redacted>" if _VOLATILE_KEY.search(str(key)) else _scrub(item))
            for key, item in value.items()
        }
    if isinstance(value, list):
        return [_scrub(item) for item in value]
    if isinstance(value, str) and any(marker in value for marker in _PATH_MARKERS):
        return "<path>"
    return value


def normalize_frames(lines: Iterable[str]) -> list[dict]:
    """Keep ``params`` only; drop session identity and volatile values."""
    frames: list[dict] = []
    for line in lines:
        line = line.strip()
        if not line:
            continue
        frame = json.loads(line)
        params = dict(frame.get("params") or {})
        if "type" not in params:
            continue
        params.pop("session_id", None)
        if isinstance(params.get("payload"), dict):
            params["payload"] = _scrub(params["payload"])
        frames.append(params)
    return frames


def frame_signature(params: dict) -> tuple[str, Any]:
    payload = params.get("payload") if isinstance(params.get("payload"), dict) else {}
    return (str(params.get("type")), payload.get("kind"))


def write_or_check(name: str, frames: list[dict]) -> Path:
    """Write the fixture when regenerating; otherwise fail on event-sequence drift."""
    path = FIXTURE_DIR / f"{name}.jsonl"
    body = "".join(json.dumps(frame, ensure_ascii=False, sort_keys=True) + "\n" for frame in frames)
    if os.environ.get(REGENERATE_ENV) == "1":
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(body, encoding="utf-8")
        return path
    hint = f"set {REGENERATE_ENV}=1 and rerun this test to regenerate {path.relative_to(ROOT)}"
    assert path.exists(), f"missing committed frame fixture; {hint}"
    committed = [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line]
    assert [frame_signature(f) for f in committed] == [frame_signature(f) for f in frames], (
        f"gateway event sequence changed; {hint}"
    )
    return path
