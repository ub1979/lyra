# Wake the existing dispatcher after project queue changes

Problem: a newly queued project may wait for the default 60-second polling tick.
Scope: best-effort shared wake marker after committed queue/resume changes. The
existing gateway watcher and standalone daemon notice it during one-second wait
slices. No new dispatcher, model call, config knob or claim mechanism.
Acceptance: same-machine requests wake promptly, requests during a tick are not
lost, failures fall back to configured polling, shutdown remains interruptible.
Tests: 278 passed across real cross-process marker, temporary SQLite queue,
real daemon, existing dispatcher/claim suites. Initial sandbox denied cleanup of
a test subprocess; permitted rerun passed with safety guard unchanged. All 463
web tests, typecheck and build passed; lint zero errors/30 existing warnings.
Compatibility: restart dispatcher/backend for behavior. Busy ticks/provider time
and concurrency/dependency limits still affect actual worker start time.
Rollback: revert; marker holds no task/user content and may safely remain.
User authorized separate version/commit/push.
