# Kanban goal-run fencing — 2026-09-08

Change / date: Fence a goal-mode worker to the exact Kanban run that spawned it, 2026-09-08.

User problem and reproduction: TG-008 routed itself to a dependency wait, which ended run 95 and cleared its claim. The dispatcher immediately promoted the task and started run 100 while the old process was still finishing its outer goal loop. That stale loop observed the new run's `running` status, issued two completion nudges that correctly failed their run-id checks, then called an unfenced internal block callback and blocked run 100. Two workers therefore overlapped on one task and the board reported a false “never finalized” failure.

In scope / explicitly deferred: Pin the quiet-mode goal loop's status reads and fallback block to `HERMES_KANBAN_RUN_ID`. Stop a stale loop as soon as another run owns the task, and preserve the database's existing compare-and-set protection. Do not change goal judging, task dependency routing, retry budgets, worker concurrency, or project files.

Acceptance criteria: A goal loop continues only while the task's `current_run_id` matches the worker's run. A superseded worker cannot judge, nudge, complete, or block its successor. Legacy/manual invocations without a run id keep their existing status-only behavior.

Affected modules and data: Quiet Kanban goal-loop wiring in `cli.py`, focused behavioral tests, the Lyra maintenance map and generated file inventory. No schema, prompt, task, conversation, project, or stored user-data migration.

Tests and observed results: The focused goal-mode and Kanban core suites passed
189 tests, including a real SQLite reproduction that ends run N, claims run
N+1, then exercises run N's late status and block callbacks. Run N reports
`superseded`; its fenced block is a no-op and run N+1 remains running. Ruff and
diff hygiene passed for the changed Python and test files.

Compatibility / restart: Newly spawned workers load the fix immediately. Existing goal-mode worker processes must finish or restart before their outer loop can use it.

Rollback / retained recovery data: Revert the focused local commit. Existing task events and runs remain the audit trail; no rows are deleted or rewritten.

Local commit / authorized push: Local implementation authorized by the user's continuing reliability request. No second push or Lyra version bump is authorized yet.
