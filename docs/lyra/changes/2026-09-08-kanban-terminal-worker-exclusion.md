# Kanban terminal-worker exclusion — 2026-09-08

Change / date: Prevent a newly claimed Kanban run from overlapping the process
of the task's just-ended run, 2026-09-08.

User problem and reproduction: The Hello reliability canary moved task
`t_76a8d9c6` to triage at the end of run 126 and cleared its active database
claim, but worker PID 93726 stayed alive. On the next dispatcher tick Lyra
started run 127 as PID 1275 while PID 93726 was still executing the same task.
The existing run-id fencing protected run 127's database row, but it could not
prevent the two processes from duplicating filesystem, terminal, or network
work.

In scope / explicitly deferred: Retain the ended run's host-local claim lock
and PID as short-lived historical process identity. Before claiming a ready or
review task, wait through a 30-second natural-exit grace; after that, terminate
a surviving local worker and start the successor only once the old PID is
confirmed gone. Refuse the new claim if termination does not succeed. Ignore
remote identities; after 15 minutes, trust a still-live PID only when its
command line identifies the exact Kanban task, so a recycled PID cannot target
an unrelated process. Do not change job logic, review policy, retry counts,
project files, or concurrency limits.

Acceptance criteria: A task whose previous run has ended cannot be claimed
again while that run's host-local worker remains alive. Normal shutdown gets a
grace period. A confirmed termination permits the next run without an extra
dispatcher interval. A process that survives termination leaves the task ready
and visibly guarded. Ready and review dispatch share the same exclusion rule.

Affected modules and data: `hermes_cli/kanban_db.py`, focused Kanban database
tests, the Lyra changelog, maintenance map, and generated file inventory. No
schema or stored-data migration is required; new ended runs simply retain two
existing columns that were previously erased.

Tests and observed results: 600 Kanban database, goal-mode, core lifecycle,
CLI, worker-run, and dashboard tests passed with one platform-specific skip.
New tests cover the natural-exit grace, confirmed termination before successor
spawn, a survivor that remains guarded, historical PID/claim retention, old
PID command-line validation, and the real POSIX process signalling path.

Compatibility / restart: Existing ended runs that already lost their PID
cannot be reconstructed. Newly ended runs gain the protection as soon as the
gateway/dispatcher restarts on this code. Active tasks and conversations are
preserved.

Rollback / retained recovery data: Revert the focused local commit. Historical
run and task events remain available; no rows are deleted or rewritten.

Local commit / authorized push: Implemented in `1e606bd66`. The user authorized
the combined Lyra 0.19.27 reliability release and push on 2026-09-08.
