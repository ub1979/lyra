"""Observe clarify results and hand preview answers to the authorization record.

``clarify`` returns ``{"question", "choices_offered", "user_response"}`` built
from the gateway's answer channel. The hook reads the question from that result
(not from model arguments) and ignores every other tool.
"""

from __future__ import annotations

import json
import logging
from typing import Any, Callable

logger = logging.getLogger(__name__)


def make_preview_clarify_hook(
    record_answer: Callable[[str, str, str], str | None],
) -> Callable[..., None]:
    """Build a ``post_tool_call`` callback bound to one ``record_answer``."""

    def on_post_tool_call(**payload: Any) -> None:
        if payload.get("tool_name") != "clarify":
            return
        try:
            result = json.loads(str(payload.get("result") or ""))
        except ValueError:
            return
        if not isinstance(result, dict) or "user_response" not in result:
            return
        try:
            record_answer(
                str(result.get("question") or ""),
                str(result.get("user_response") or ""),
                str(payload.get("session_id") or ""),
            )
        except Exception:  # an observer must never break the conversation
            logger.exception("Could not record the preview answer")

    return on_post_tool_call
