"""Save and read provider-reported usage for durable Kanban worker runs.

A durable worker runs in its own process with its own session, so the
coordinator's session counters never include it, and the dispatcher's
``task_runs`` rows carry no accounting at all. ``task_runs.metadata`` is the
obvious place but it is serialized into child worker prompts, so usage lives
in its own ``task_events`` row instead: Studio can read it and no prompt
ever sees it. A task without such a row has *unknown* usage, never zero.

Rows are cumulative snapshots of one worker run. A retry is a new
run, so a task's spending is the sum of the newest snapshot of every
distinct attempt — never just the newest row, which would discard the
earlier attempts' tokens.
"""

from __future__ import annotations

import json
import os
import sqlite3
import time
from typing import Any, Iterable, Mapping, Optional

from hermes_cli import kanban_db as kb

USAGE_EVENT_KIND = "usage"

_COUNTER_KEYS = (
    "input_tokens",
    "output_tokens",
    "cache_read_tokens",
    "cache_write_tokens",
    "reasoning_tokens",
    "api_calls",
)
_SQL_VARIABLE_CHUNK = 500
_AGENT_SESSION_ATTRIBUTES = {
    "input_tokens": "session_input_tokens",
    "output_tokens": "session_output_tokens",
    "cache_read_tokens": "session_cache_read_tokens",
    "cache_write_tokens": "session_cache_write_tokens",
    "reasoning_tokens": "session_reasoning_tokens",
    "api_calls": "session_api_calls",
    "estimated_cost_usd": "session_estimated_cost_usd",
    "cost_status": "session_cost_status",
    "cost_source": "session_cost_source",
    "model": "model",
    "session_id": "session_id",
}


def _count(value: Any) -> int:
    return int(value) if isinstance(value, (int, float)) and value >= 0 else 0


def usage_from_run_result(result: Any) -> Optional[dict]:
    """Compact the ``run_conversation`` result; ``None`` when it reported no counters."""
    if not isinstance(result, dict):
        return None
    if not any(key in result for key in _COUNTER_KEYS):
        return None
    cost = result.get("estimated_cost_usd")
    return {
        **{key: _count(result.get(key)) for key in _COUNTER_KEYS},
        "cost_usd": float(cost) if isinstance(cost, (int, float)) and cost > 0 else None,
        "cost_status": str(result.get("cost_status") or ""),
        "cost_source": str(result.get("cost_source") or ""),
        "model": str(result.get("model") or ""),
        "session_id": str(result.get("session_id") or ""),
        "recorded_at": int(time.time()),
    }


def usage_from_agent(agent: Any) -> Optional[dict]:
    """Read the agent's cumulative session counters, so every turn of a run counts.

    A goal-mode worker keeps calling the model in the same session after its
    first ``run_conversation`` result; that result is stale by the time the
    worker exits, while the agent's ``session_*`` totals are not.
    """
    present = {
        key: getattr(agent, attribute)
        for key, attribute in _AGENT_SESSION_ATTRIBUTES.items()
        if hasattr(agent, attribute)
    }
    return usage_from_run_result(present)


def record_run_usage(
    conn: sqlite3.Connection,
    task_id: str,
    usage: Optional[dict],
    *,
    run_id: Optional[int] = None,
) -> bool:
    """Append one usage event inside the caller's transaction; nothing for ``None``."""
    if not usage:
        return False
    kb._append_event(conn, task_id, USAGE_EVENT_KIND, usage, run_id=run_id)
    return True


def record_worker_run_usage_from_env(
    usage: Optional[dict], environ: Mapping[str, str] = os.environ
) -> bool:
    """Save this worker process's usage on the task the dispatcher assigned it.

    The dispatcher identifies the worker through ``HERMES_KANBAN_TASK``,
    ``HERMES_KANBAN_RUN_ID`` and ``HERMES_KANBAN_BOARD`` (``HERMES_KANBAN_DB``
    still wins inside ``connect`` when set). Nothing is written for a process
    that is not a Kanban worker or whose run reported no counters.
    """
    task_id = str(environ.get("HERMES_KANBAN_TASK") or "")
    if not task_id or not usage:
        return False
    run_id_raw = str(environ.get("HERMES_KANBAN_RUN_ID") or "")
    run_id = int(run_id_raw) if run_id_raw.isdigit() else None
    board = str(environ.get("HERMES_KANBAN_BOARD") or "") or None
    with kb.connect_closing(board=board) as conn, kb.write_txn(conn):
        return record_run_usage(conn, task_id, usage, run_id=run_id)


_SNAPSHOT_MIN_INTERVAL_SECONDS = 30.0


def record_worker_usage_snapshot(
    agent: Any,
    environ: Mapping[str, str] = os.environ,
    *,
    now: Optional[float] = None,
) -> bool:
    """Save an in-flight cumulative snapshot so a long first attempt is not "unreported".

    Throttled to one attempt every 30 seconds and skipped while counters
    have not moved. Failed writes remain retryable after that interval.
    Snapshots of one session are cumulative; the reader keeps only the newest
    per attempt, so they never double count.
    """
    if not environ.get("HERMES_KANBAN_TASK"):
        return False
    usage = usage_from_agent(agent)
    if not usage or not usage["api_calls"]:
        return False
    current = time.monotonic() if now is None else now
    identity = tuple(environ.get(key) for key in (
        "HERMES_KANBAN_HOME", "HERMES_KANBAN_DB", "HERMES_KANBAN_BOARD",
        "HERMES_KANBAN_TASK", "HERMES_KANBAN_RUN_ID",
    )) + (usage["session_id"],)
    state = getattr(agent, "_kanban_usage_snapshot", {})
    if state.get("identity") != identity:
        state = {"identity": identity, "at": float("-inf"), "saved": None}
        agent._kanban_usage_snapshot = state
    # Usage can arrive after the API call counter advances. Compare all saved
    # fields except the sampling timestamp, not just the number of calls.
    fingerprint = {key: value for key, value in usage.items() if key != "recorded_at"}
    if (
        current - state["at"] < _SNAPSHOT_MIN_INTERVAL_SECONDS
        or fingerprint == state["saved"]
    ):
        return False
    state["at"] = current
    saved = record_worker_run_usage_from_env(usage, environ)
    if saved:
        state["saved"] = fingerprint
    return saved


def _attempt_key(payload: dict, run_id: Optional[int], row_id: int) -> str:
    # Compression rotates session IDs without resetting cumulative counters.
    # The dispatcher's run ID remains the identity of that one paid attempt.
    if run_id is not None:
        return f"run:{run_id}"
    session_id = str(payload.get("session_id") or "")
    if session_id:
        return f"session:{session_id}"
    return f"event:{row_id}"


def _sum_attempts(attempts: list[dict]) -> dict:
    latest = attempts[0]
    priced = [a["cost_usd"] for a in attempts if isinstance(a.get("cost_usd"), (int, float))]
    return {
        **{key: sum(_count(a.get(key)) for a in attempts) for key in _COUNTER_KEYS},
        "cost_usd": float(sum(priced)) if priced else None,
        "cost_status": (
            "partial" if 0 < len(priced) < len(attempts) else str(latest.get("cost_status") or "")
        ),
        "cost_source": str(latest.get("cost_source") or ""),
        "model": str(latest.get("model") or ""),
        "session_id": str(latest.get("session_id") or ""),
        "attempts": len(attempts),
        "recorded_at": max(_count(a.get("recorded_at")) for a in attempts),
    }


def run_usage_totals_by_task(
    conn: sqlite3.Connection, task_ids: Iterable[str]
) -> dict[str, dict]:
    """Total spending per task: newest cumulative snapshot of each distinct attempt, summed.

    Each worker run writes cumulative snapshots, so within one attempt only
    the newest row counts; across retries every attempt's newest row is added.
    One query per chunk of ids. Tasks with no usage row are absent (unknown).
    """
    ids = [str(task_id) for task_id in dict.fromkeys(task_ids) if task_id]
    latest_by_attempt: dict[str, dict[str, dict]] = {}
    for start in range(0, len(ids), _SQL_VARIABLE_CHUNK):
        chunk = ids[start : start + _SQL_VARIABLE_CHUNK]
        rows = conn.execute(
            "SELECT id, task_id, run_id, payload FROM task_events "
            f"WHERE kind = ? AND task_id IN ({','.join('?' * len(chunk))}) "
            "ORDER BY created_at DESC, id DESC",
            (USAGE_EVENT_KIND, *chunk),
        ).fetchall()
        for row in rows:
            try:
                payload = json.loads(row["payload"]) if row["payload"] else None
            except Exception:
                payload = None
            if not isinstance(payload, dict):
                continue
            run_id = int(row["run_id"]) if row["run_id"] is not None else None
            attempts = latest_by_attempt.setdefault(row["task_id"], {})
            attempts.setdefault(_attempt_key(payload, run_id, int(row["id"])), payload)
    return {
        task_id: _sum_attempts(list(attempts.values()))
        for task_id, attempts in latest_by_attempt.items()
    }
