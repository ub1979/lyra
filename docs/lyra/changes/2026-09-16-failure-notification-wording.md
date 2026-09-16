# Truthful failure and retry notifications — 2026-09-16

Change / date: project job notifications name failed, retried and abandoned
attempts instead of calling every non-blocked state "finished"; 16 September 2026.

User problem and reproduction: `notification_text` in
`hermes_cli/project_job_attention.py` said "`<title>` finished" for any task
status other than blocked/triage. The gateway also claims `crashed`, `timed_out`
and `gave_up` events, and by the time the notification is read the task has
often returned to `ready` or `running`, so a failed attempt with a queued retry
was announced as completed work.

In scope / explicitly deferred: the `kanban_task` notification event now carries
`event_kind`; the visible sentence branches on it first (`crashed`/`timed_out`
→ attempt failed, retry queued; `gave_up` → stopped after repeated failures,
needs a decision; blocked kinds → needs attention; `completed` → finished) and
falls back to task status, where only `completed`/`done`/`review`/`archived`
read as finished and non-terminal states read as "is continuing". The internal
coordinator envelope includes `event_kind` and instructs Lyra never to describe
a failed attempt as finished. Deferred: changing which event kinds the gateway
subscribes to.

Acceptance criteria: the word "finished" appears only for completed/done
outcomes; failed and retried attempts are described as such; review handoffs
are unchanged; the JSON envelope round-trips `event_kind`.

Affected modules and data: `hermes_cli/project_job_attention.py`,
`tui_gateway/server.py` (one added key in `_claim_kanban_tui_notification`).
No stored data changes.

Tests and observed results: `tests/hermes_cli/test_project_job_attention.py`
12 passed (10 parametrised kind/status cases plus the two existing tests);
gateway suites 474 passed.

Compatibility / restart: restart Lyra. Older saved events without `event_kind`
fall back to status-based wording.

Rollback / retained recovery data: revert the commit; nothing stored changes.

Local commit / authorized push: local commit; no push requested.
