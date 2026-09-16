"""Save and read provider-reported usage for durable Kanban worker runs.

A durable worker runs in its own process with its own session, so the
coordinator's session counters never include it, and the dispatcher's
``task_runs`` rows carry no accounting at all. ``task_runs.metadata`` is the
obvious place but it is serialized into child worker prompts, so usage lives
in its own ``task_events`` row instead: Studio can read it and no prompt
ever sees it. A task without such a row has *unknown* usage, never zero.
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
    result: Any, environ: Mapping[str, str] = os.environ
) -> bool:
    """Save this worker process's usage on the task the dispatcher assigned it.

    The dispatcher identifies the worker through ``HERMES_KANBAN_TASK`` and
    ``HERMES_KANBAN_RUN_ID``; the board resolves through the same environment
    chain the worker's own Kanban tools use. Nothing is written for a process
    that is not a Kanban worker or whose run reported no counters.
    """
    task_id = str(environ.get("HERMES_KANBAN_TASK") or "")
    usage = usage_from_run_result(result)
    if not task_id or usage is None:
        return False
    run_id_raw = str(environ.get("HERMES_KANBAN_RUN_ID") or "")
    run_id = int(run_id_raw) if run_id_raw.isdigit() else None
    with kb.connect_closing() as conn, kb.write_txn(conn):
        return record_run_usage(conn, task_id, usage, run_id=run_id)


def latest_run_usage_by_task(
    conn: sqlite3.Connection, task_ids: Iterable[str]
) -> dict[str, dict]:
    """Newest saved usage per task in one query per chunk; unreported tasks are absent."""
    ids = [str(task_id) for task_id in dict.fromkeys(task_ids) if task_id]
    latest: dict[str, dict] = {}
    for start in range(0, len(ids), _SQL_VARIABLE_CHUNK):
        chunk = ids[start : start + _SQL_VARIABLE_CHUNK]
        rows = conn.execute(
            "SELECT task_id, payload FROM task_events "
            f"WHERE kind = ? AND task_id IN ({','.join('?' * len(chunk))}) "
            "ORDER BY created_at DESC, id DESC",
            (USAGE_EVENT_KIND, *chunk),
        ).fetchall()
        for row in rows:
            task_id = row["task_id"]
            if task_id in latest:
                continue
            try:
                payload = json.loads(row["payload"]) if row["payload"] else None
            except Exception:
                payload = None
            if isinstance(payload, dict):
                latest[task_id] = payload
    return latest
