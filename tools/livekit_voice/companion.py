"""Companion agent: narrates builder progress and answers questions via voice.

Two modes:
1. Progress narrator (no LLM) — maps event types to templated speech.
2. Interactive responder — when user speaks during a build, uses the
   configured LLM for a single-turn voice-only response.
"""

from __future__ import annotations

import logging
from typing import Any, Optional

logger = logging.getLogger(__name__)

_NARRATION_TEMPLATES: dict[str, str] = {
    "tool.start": "Running {name}.",
    "tool.progress": "{summary}",
    "tool.generating": "Generating code.",
    "tool.complete": "Done with {name}.",
    "subagent.spawn_requested": "A specialist is starting work on {goal}.",
    "subagent.start": "Specialist working on {goal}.",
    "subagent.thinking": "Specialist is thinking.",
    "subagent.progress": "{summary}",
    "subagent.tool": "Specialist is using {name}.",
    "subagent.complete": "Specialist finished.",
    "message.start": "Working on it now.",
    "message.complete": "All done.",
}


def narrate_event(event_type: str, payload: Optional[dict]) -> Optional[str]:
    """Return a short narration string for the given event, or None to skip."""
    template = _NARRATION_TEMPLATES.get(event_type)
    if not template:
        return None

    p = payload or {}
    fields = {
        "name": p.get("name", "a tool"),
        "goal": p.get("goal", p.get("context", "this task")),
        "summary": p.get("summary", p.get("text", "")),
    }

    if event_type in ("tool.progress", "subagent.progress") and not fields["summary"]:
        return None

    try:
        return template.format(**fields)
    except (KeyError, IndexError):
        return None


async def respond_to_user(
    transcript: str,
    recent_events: list[dict],
) -> Optional[str]:
    """Generate a short voice-only response to a user question during a build.

    Uses the configured LLM for a single-turn response. The context includes
    recent build events so the companion can describe what's happening.
    """
    context_lines = []
    for ev in recent_events[-10:]:
        narration = narrate_event(ev.get("type", ""), ev.get("payload"))
        if narration:
            context_lines.append(narration)

    context_summary = " ".join(context_lines) if context_lines else "The builder is working."

    system_prompt = (
        "You are Lyra's voice companion. The builder agent is currently working "
        "on a task in the background. The user asked a question via voice. "
        "Give a brief, conversational answer (1-2 sentences max). "
        "Do NOT use markdown, code blocks, or formatting — this will be spoken aloud.\n\n"
        f"Recent build activity: {context_summary}"
    )

    try:
        from agent.auxiliary_client import async_call_llm, extract_content_or_reasoning
        resp = await async_call_llm(
            task="voice_companion",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": transcript},
            ],
            max_tokens=150,
            temperature=0.7,
            timeout=15,
        )
        text = extract_content_or_reasoning(resp)
        return text.strip() if text else None
    except Exception:
        logger.warning("Companion LLM response failed", exc_info=True)
        return f"I'm working on it right now. {context_summary}"
