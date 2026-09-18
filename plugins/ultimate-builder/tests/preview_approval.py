"""Test helper: record a user's preview decision through the real checkpoint API.

Tests about queueing, routing or recovery need Development to be allowed. They
use the same path a real user answer takes: open the checkpoint, then record
the answer as the clarify hook would.
"""

from __future__ import annotations

import importlib.util
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def load_preview_authorization():
    spec = importlib.util.spec_from_file_location(
        "ultimate_builder_preview_authorization_test", ROOT / "preview_authorization.py"
    )
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)
    return module


def approve_preview(project: Path, answer: str = "Approve", session_id: str = "") -> str:
    """Open a checkpoint for ``project`` and answer it as the user."""
    authorization = load_preview_authorization()
    checkpoint = authorization.open_checkpoint(Path(project), session_id)
    if answer == "Approve" and "Approve" not in checkpoint["choices"]:
        answer = "Start building"
    decision = authorization.record_answer(checkpoint["question"], answer, session_id)
    assert decision is not None
    return decision
