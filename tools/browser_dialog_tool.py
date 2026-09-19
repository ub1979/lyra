"""Respond to dialogs through the existing supervisor, including local browsers.

This tool is response-only — the agent first reads ``pending_dialogs`` from
``browser_snapshot`` output, then calls ``browser_dialog(action=...)`` to
accept or dismiss.

Local Chromium is discovered on its task-owned endpoint after navigation;
the raw CDP tool's availability and the user's browser configuration are unchanged.

See ``website/docs/developer-guide/browser-supervisor.md`` for the full
design.
"""

from __future__ import annotations

import json
import logging
from typing import Any, Dict, Optional

from tools.browser_supervisor import SUPERVISOR_REGISTRY
from tools.registry import registry

logger = logging.getLogger(__name__)


BROWSER_DIALOG_SCHEMA: Dict[str, Any] = {
    "name": "browser_dialog",
    "description": (
        "Respond to a native JavaScript dialog (alert / confirm / prompt / "
        "beforeunload) that is currently blocking the page.\n\n"
        "**Workflow:** call ``browser_snapshot`` first — if a dialog is open, "
        "it appears in the ``pending_dialogs`` field with ``id``, ``type``, "
        "and ``message``. Then call this tool with ``action='accept'`` or "
        "``action='dismiss'``.\n\n"
        "**Prompt dialogs:** pass ``prompt_text`` to supply the response "
        "string. Ignored for alert/confirm/beforeunload.\n\n"
        "**Multiple dialogs:** if more than one dialog is queued (rare — "
        "happens when a second dialog fires while the first is still open), "
        "pass ``dialog_id`` from the snapshot to disambiguate.\n\n"
        "**Availability:** supported local Chromium and CDP-capable backends. "
        "Not available on Camofox (REST-only). A pending dialog can also appear "
        "in an action's result. Respond before repeating the original action."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "action": {
                "type": "string",
                "enum": ["accept", "dismiss"],
                "description": (
                    "'accept' clicks OK / returns the prompt text. "
                    "'dismiss' clicks Cancel / returns null from prompt(). "
                    "For ``beforeunload`` dialogs: 'accept' allows the "
                    "navigation, 'dismiss' keeps the page."
                ),
            },
            "prompt_text": {
                "type": "string",
                "description": (
                    "Response string for a ``prompt()`` dialog. Ignored for "
                    "other dialog types. Defaults to empty string."
                ),
            },
            "dialog_id": {
                "type": "string",
                "description": (
                    "Specific dialog to respond to, from "
                    "``browser_snapshot.pending_dialogs[].id``. Required "
                    "only when multiple dialogs are queued."
                ),
            },
        },
        "required": ["action"],
    },
}


def browser_dialog(
    action: str,
    prompt_text: Optional[str] = None,
    dialog_id: Optional[str] = None,
    task_id: Optional[str] = None,
) -> str:
    """Respond to a pending dialog on the active task's CDP supervisor."""
    from tools.browser_tool import _last_session_key

    effective_task_id = _last_session_key(task_id or "default")
    supervisor = SUPERVISOR_REGISTRY.get(effective_task_id)
    if supervisor is None:
        return json.dumps(
            {
                "success": False,
                "error": (
                    "No CDP supervisor is attached to this task. Either the "
                    "browser backend doesn't expose CDP or its dialog "
                    "connection is unavailable. "
                    "Call browser_navigate or /browser connect first."
                ),
            }
        )

    result = supervisor.respond_to_dialog(
        action=action,
        prompt_text=prompt_text,
        dialog_id=dialog_id,
    )
    if result.get("ok"):
        return json.dumps(
            {
                "success": True,
                "action": action,
                "dialog": result.get("dialog", {}),
            }
        )
    return json.dumps({"success": False, "error": result.get("error", "unknown error")})


def _browser_dialog_check() -> bool:
    """Advertise local Chromium at session creation, without probing or spawning."""
    try:
        from tools.browser_cdp_tool import _browser_cdp_check  # type: ignore[import-not-found]
    except Exception as exc:  # pragma: no cover — defensive
        logger.debug("browser_dialog check: browser_cdp_tool import failed: %s", exc)
        return False
    if _browser_cdp_check():
        return True
    from tools import browser_tool as bt

    return (not bt._is_camofox_mode() and bt._is_local_mode()
            and not bt._using_lightpanda_engine() and bt.check_browser_requirements())


registry.register(
    name="browser_dialog",
    toolset="browser-cdp",
    schema=BROWSER_DIALOG_SCHEMA,
    handler=lambda args, **kw: browser_dialog(
        action=args.get("action", ""),
        prompt_text=args.get("prompt_text"),
        dialog_id=args.get("dialog_id"),
        task_id=kw.get("task_id"),
    ),
    check_fn=_browser_dialog_check,
    emoji="💬",
)
