# Delegated worker stale recovery — 2026-09-08

Change / date: Return control when a delegated helper stops making progress, 2026-09-08.

User problem and reproduction: A live Hello review stopped writing its worker log while its outer Kanban process continued to emit healthy-looking heartbeats. The delegation monitor later logged that an internal helper was stale, but it only stopped relaying that helper's heartbeat; the synchronous `delegate_task` call still waited without a default wall-clock bound. Because Kanban has an independent process heartbeat, the job remained visibly running until it was manually reclaimed.

In scope / explicitly deferred: Treat the existing heartbeat stale threshold as a terminal delegation signal: interrupt the child, return a structured timeout to the parent, and let the parent recover or report the failure. Preserve the longer threshold for tools that legitimately run for a long time and preserve the optional configured hard timeout. Do not shorten provider, tool or Kanban task timeouts and do not change prompt/tool schemas.

Acceptance criteria: A child whose tool and API-call counters remain unchanged through the applicable stale threshold is interrupted. The waiting delegation future observes the stale signal and returns control even when no hard child timeout is configured. A child that finishes at the same boundary cannot be reported as successful after already being declared stale. Long-running active tools continue to use their existing extended grace.

Affected modules and data: `tools/delegate_tool.py`, its behavioral heartbeat tests, the Lyra maintenance map and file inventory. No database, task, conversation, prompt, configuration or generated Hello application data migration.

Tests and observed results: The live false-liveness case was confirmed from the Hello worker log and delegation warning, then recovered by preserving the shared workspace, reclaiming the stalled worker and relaunching it. The new regression failed before the implementation because stale detection did not interrupt the child and the call returned a late success. After the fix, the stale child was interrupted and the parent received a timeout. The repository test runner passed 246 tests across the full delegation, async delegation, timeout-diagnostic, live-log and Kanban-isolation files.

Compatibility / restart: Newly spawned Kanban workers import the corrected source automatically. Already-running long-lived chat processes need restart or a fresh backend session before their own delegation calls use the correction; active jobs are not interrupted solely to reload it.

Rollback / retained recovery data: Revert the focused local commit. The recovered Hello review kept its shared test changes and task history; no recovery data was deleted.

Local commit / authorized push: Local commit only. No push or release is authorized, so no Lyra version bump is included.
