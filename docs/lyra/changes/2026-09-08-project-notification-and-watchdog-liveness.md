# Project child notifications and Studio liveness — 2026-09-08

User problem and reproduction:
An active Lyra project appeared stalled after automatic decomposition. Two child
jobs had saved their work and blocked for review, but only the decomposed parent
retained the originating TUI subscription, so the review requests never reached
the coordinating conversation. Separately, Studio ignored the backend's
30-second supervised-wait heartbeat and could send Ctrl-C after 125 seconds even
while the backend remained alive and responsible for provider retry/timeout.

In scope / explicitly deferred:
Copy an existing parent task's durable notification subscriptions to every
automatically decomposed child, treat a structured supervised-wait notice as
backend liveness in Studio, and backfill the affected Hello child subscriptions.
Do not approve blocked reviews, rewrite generated project evidence, change model
or tool budgets, or edit the supplied HTML reports.

Acceptance criteria:
- Every decomposed child inherits all notification destinations and cursor state
  from its parent in the same atomic transaction.
- An unsubscribed parent creates no child subscriptions.
- A later child review/block event is claimable by the originating destination.
- Studio keeps a supervised backend request alive while structured wait
  heartbeats arrive, while true silence remains bounded by the existing timer.
- Existing display behavior for wait text and genuine reasoning remains intact.

Affected modules and data:
`hermes_cli/kanban_db.py`, TUI event payloads, Studio watchdog policy, focused
Python/browser tests, the searchable file inventory, and notification rows for
the six already-created Hello decomposition children. No schema migration and
no generated Hello source/evidence edits.

Tests and observed results:
- Notification/decomposition, Kanban database, saved project workflow, wait
  visibility, project runs and progress: 299 tests passed.
- Studio typecheck and 396 browser tests passed.
- Studio lint completed with zero errors and 31 pre-existing warnings outside
  this change.
- Production Studio build completed and the maintained file inventory passed
  its generated-file check with unrelated local files excluded.
- The six affected Hello children now retain the originating TUI subscription
  at cursor 625; task statuses and generated project files were not changed.

Compatibility / restart:
No schema change. Running Studio/backend processes need a Lyra restart to load
the code fix. The targeted notification-row backfill is immediately readable by
the existing poller and does not change task status.

Rollback / retained recovery data:
Revert the code change. Before the live backfill, retain a timestamped copy of
the Kanban database; inherited subscription rows can be removed using the exact
recorded child ids without altering task history. The retained backup is
`~/.hermes/backups/kanban-before-child-notify-20260908-0219.db`.

Local commit / authorized push:
No push authorized. Local commit pending verification.
