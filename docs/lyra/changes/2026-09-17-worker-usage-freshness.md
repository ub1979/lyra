# Worker usage freshness

Problem: worker usage waits up to two minutes between snapshots. A failed write
also advances the old deduplication state, suppressing retries of unchanged
counters. A saved usage total has no timestamp in the activity panel.
Scope: reuse existing activity hook and cumulative SQLite usage events; no new
poller, model call, heartbeat interpretation or accounting schema.
Acceptance: snapshots at most once per 30 seconds per agent; unchanged totals
are not rewritten; failed writes remain retryable; separate attempts cannot
suppress each other. UI distinguishes usage timestamps from activity timestamps.
Verification: 15 temporary-SQLite/accounting tests passed, including failure/retry,
late usage and agent/run isolation. All 463 web tests, typecheck and build passed;
lint has zero errors and 30 existing warnings. No real-provider timing claim.
Compatibility: backend restart for the snapshot policy; browser reload for UI.
Recovery: revert this change; existing usage rows remain readable. No migration.
User authorized one separate version/commit/push for this fix.
