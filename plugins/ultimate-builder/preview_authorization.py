"""Decide whether Development may start: the user's preview decision.

Flow:
1. The coordinator calls ``project_run`` with ``action=preview``. The backend
   writes the question and choices and records the preview digest.
2. The coordinator shows that exact question with the ``clarify`` tool.
3. The ``post_tool_call`` hook passes the clarify result to
   :func:`record_answer`. That result comes from the gateway's user-answer
   channel, never from model text.
4. ``queue_project_run`` calls :func:`development_refusal` before creating the
   first Development job for the workspace.
"""

from __future__ import annotations

import importlib.util
import secrets
import time
from pathlib import Path
from typing import Any

_ROOT = Path(__file__).resolve().parent
_modules: dict[str, Any] = {}

PREVIEW_CHOICES = ["Approve", "Change", "Skip"]
NO_PREVIEW_CHOICES = ["Start building", "Make a preview first"]


def _sibling(name: str) -> Any:
    if name not in _modules:
        spec = importlib.util.spec_from_file_location(
            f"lyra_preview_authorization_{name}", _ROOT / f"{name}.py"
        )
        if spec is None or spec.loader is None:
            raise RuntimeError(f"Could not load {name}")
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        _modules[name] = module
    return _modules[name]


def open_checkpoint(project: Path, session_id: str) -> dict[str, Any]:
    """Create the pending checkpoint and return what the coordinator must ask."""
    project = Path(project).resolve()
    digest = _sibling("preview_digest").preview_digest(project)
    # The token makes each question unique, so an answer to an older question
    # can never resolve a newer checkpoint.
    token = secrets.token_hex(3)
    if digest:
        question = (
            f"Preview check {token}: the visual preview is ready at "
            ".sdlc/preview/index.html. Does it look right before building starts?"
        )
        choices = PREVIEW_CHOICES
    else:
        question = (
            f"Preview check {token}: no visual preview was made for this project. "
            "Start building without one?"
        )
        choices = NO_PREVIEW_CHOICES
    _sibling("preview_checkpoint_store").save_checkpoint(project, {
        "status": "pending",
        "question": question,
        "choices": choices,
        "digest": digest,
        "session_id": str(session_id or ""),
        "opened_at": int(time.time()),
    })
    return {
        "ok": True,
        "question": question,
        "choices": choices,
        "instruction": (
            "Call clarify now with exactly this question and these choices, "
            "then end your turn. Building can start only after the user's answer."
        ),
    }


def record_answer(question: str, answer: str, session_id: str) -> str | None:
    """Record a user answer for the open checkpoint; return the decision or None."""
    store = _sibling("preview_checkpoint_store")
    found = store.find_open_checkpoint(str(question or ""))
    if found is None:
        return None
    project, record = found
    expected_session = str(record.get("session_id") or "")
    # An answer from a different conversation is not this user's decision here.
    if expected_session and str(session_id or "") != expected_session:
        return None
    decision = _sibling("preview_answer").classify_preview_answer(answer)
    record.update({"status": decision, "answered_at": int(time.time())})
    store.save_checkpoint(project, record)
    return decision


def development_refusal(project: Path) -> str | None:
    """Return a plain refusal message, or None when Development may be queued."""
    answer = _sibling("preview_answer")
    record = _sibling("preview_checkpoint_store").load_checkpoint(Path(project))
    ask_again = (
        "Present it with project_run action=preview, then ask the user with clarify."
    )
    if record is None:
        return "Building needs the user's preview decision first. " + ask_again
    status = record.get("status")
    if status == answer.SKIP:
        return None
    if status == answer.APPROVE:
        current = _sibling("preview_digest").preview_digest(Path(project))
        if current == record.get("digest"):
            return None
        return "The preview changed after the user approved it. " + ask_again
    if status == "pending":
        return "The user has not answered the preview question yet. Wait for the answer."
    if status == answer.CHANGE:
        return "The user asked for preview changes. Update the preview, then ask again."
    return "The user's preview answer was unclear. " + ask_again
