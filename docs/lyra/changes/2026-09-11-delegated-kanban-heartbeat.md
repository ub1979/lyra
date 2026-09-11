# Delegated Kanban heartbeat ownership — 2026-09-11

Change / date: Prevent delegated child activity from suppressing its owning Kanban worker's durable heartbeat, 2026-09-11.

User problem and reproduction: A live Architecture job was shown as “working — waiting for a fresh update” while its delegated child continued making model and tool calls. The child and parent share a process-wide Kanban environment and heartbeat rate limiter. Child activity advanced that limiter before its forbidden Kanban write failed, repeatedly preventing the parent relay thread from recording a legitimate heartbeat.

In scope / explicitly deferred: Skip automatic Kanban heartbeat attempts in delegated-child context before consuming the rate-limit slot. Preserve the existing child mutation boundary and allow the parent heartbeat relay to update the owning run. Do not change quiet/stale thresholds, task ownership, delegation timeouts, or project data.

Acceptance criteria: Child activity cannot mutate Kanban state or consume the parent's automatic heartbeat slot; the next parent activity writes a heartbeat for its current fenced run; existing delegate isolation and heartbeat behavior remain green.

Affected modules and data: Automatic worker heartbeat bridge in `tools/kanban_tools.py`, delegated-child isolation tests, and Lyra's maintenance inventory. Existing task rows receive the same heartbeat events as designed; there is no schema or stored-project migration.

Tests and observed results: The clean-environment delegation, isolation, Kanban tool, timeout diagnostic, and project activity suites passed 331 tests across five files. The new regression enters a delegated-child context with the owning worker's environment, proves the child neither writes nor advances the shared throttle, then proves the parent immediately records its fenced heartbeat. Live logs independently showed the affected child continuing through model call 10 while the pre-fix saved status remained quiet, then returning to fresh only when control reached the parent again.

Compatibility / restart: Dispatcher workers launched before this change keep the old in-memory function until they finish. New workers need an updated runtime process; no data migration is required.

Rollback / retained recovery data: Revert the focused local commit. Existing tasks, runs, events, conversations, and project files remain intact.

Local commit / authorized push: Implemented and verified in this local change set. No push has been requested for this follow-up yet.
