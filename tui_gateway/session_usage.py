"""Read-only lifetime usage for a gateway agent resumed from saved history.

The model loop persists per-call deltas and keeps process-local counters. A
fixed pre-build baseline plus those counters is the display total; reading and
adding the continually growing database on every event would double-count it.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from math import isfinite

_FIELDS = {
    "input": "input_tokens", "output": "output_tokens",
    "cache_read": "cache_read_tokens", "cache_write": "cache_write_tokens",
    "reasoning": "reasoning_tokens", "calls": "api_call_count",
}
_COUNTERS = {*_FIELDS, "prompt", "completion", "total", "cost_usd"}


@dataclass(frozen=True)
class UsageBaseline:
    totals: dict | None


def _number(value) -> float:
    return value if isinstance(value, (int, float)) and not isinstance(value, bool) and isfinite(value) and value >= 0 else 0


def saved_usage_baseline(db, session_id: str) -> UsageBaseline:
    """Run during agent construction, not while handling each UI event.

    Hermes' existing lineage resolver excludes delegated and branched sessions;
    compression continuations are the same conversation and must be retained.
    Missing row means a genuinely new session. Failed reads remain unknown.
    """
    if db is None:
        return UsageBaseline(None)
    try:
        lineage = db.get_compression_lineage(session_id)
        if not isinstance(lineage, list):
            return UsageBaseline(None)
        totals = dict.fromkeys(_FIELDS, 0)
        cost = None
        for sid in dict.fromkeys(lineage):
            row = db.get_session(sid)
            if not isinstance(row, dict):
                return UsageBaseline(None)
            for output, column in _FIELDS.items():
                totals[output] += _number(row.get(column))
            if row.get("estimated_cost_usd") is not None and row.get("cost_status") == "estimated":
                cost = (cost or 0) + _number(row["estimated_cost_usd"])
        totals["prompt"] = totals["input"] + totals["cache_read"] + totals["cache_write"]
        totals["completion"] = totals["output"]
        # Reasoning is a subset of output, not another additive bucket.
        totals["total"] = totals["prompt"] + totals["output"]
        if cost is not None:
            totals["cost_usd"] = cost
        return UsageBaseline(totals)
    except Exception:
        logging.getLogger(__name__).warning("Saved usage unavailable during agent construction", exc_info=True)
        return UsageBaseline(None)


def lifetime_usage(agent, runtime: dict) -> dict:
    """Merge for presentation only; never modify the agent's billing counters."""
    baseline = getattr(agent, "_gateway_usage_baseline", None)
    if not isinstance(baseline, UsageBaseline):
        return runtime
    if baseline.totals is None:
        # Do not advertise runtime-only numbers as a known conversation total.
        return {**{k: v for k, v in runtime.items() if k not in _COUNTERS},
                "usage_status": "unavailable"}
    result = dict(runtime)
    for key, value in baseline.totals.items():
        result[key] = value + _number(runtime.get(key))
    if "cost_usd" in baseline.totals:
        result["cost_status"] = "estimated"
    return result
