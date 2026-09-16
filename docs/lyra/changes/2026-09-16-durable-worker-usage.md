# Durable worker usage and unknown accounting — 2026-09-16

Change / date: save each durable Kanban worker's provider-reported usage on its
task, show it in Studio beside the job and as a separate "Project agents"
total, and label unreported usage as unknown rather than zero; 16 September 2026.

User problem and reproduction: after 0.19.37 routed specialist work to durable
background workers, the Studio Tokens counter stayed near zero while workers
spent tokens in their own processes. Workers persisted no usage anywhere
(`tasks`/`task_runs` have no accounting columns), `ProjectAgentJobs` rendered
none, and the frontend coerced a missing usage payload to `0`, so "unknown"
and "zero" were indistinguishable.

In scope / explicitly deferred: new `hermes_cli/kanban_usage.py` compacts the
`run_conversation` result into a `task_events` row of kind `usage` (never
`task_runs.metadata`, which is serialized into child worker prompts), reads the
newest row per task in one query per board, and gives the quiet worker path in
`cli.py` a single guarded call keyed on `HERMES_KANBAN_TASK`/`HERMES_KANBAN_RUN_ID`.
`project_run_state()` adds `usage` (dict or `None`) to each task. Frontend:
`web/src/lib/project-agent-usage.ts` (null-preserving normalisation, totals
over every reported job including finished ones, formatting), a usage line on
each job card, and in the Tokens panel a "Lyra only" scope label, an "Updated"
time and a "Project agents … N of M reported" row that is never summed into
Lyra's own number. `GuidedUsageSnapshot` gains `reported`, `costStatus` and
`updatedAt`; an empty payload stays unreported. Deferred: usage for runs ended
by the crash/timeout reaper (no agent exists, so they correctly stay unknown),
historical runs before this release, and the backend `_get_usage` zero-fill
that other consumers rely on.

Acceptance criteria: a worker run records one usage event with counters, cost
(or `null` when unpriced), model and session id; the latest record wins;
unreported tasks are absent from the map and shown as "Usage not reported";
saved usage never appears in `build_worker_context`; the Tokens header shows
"Not reported yet" for an empty snapshot; the Project agents row counts
reported versus total jobs.

Affected modules and data: `hermes_cli/kanban_usage.py` (new), `cli.py`,
`plugins/ultimate-builder/project_runs.py`, `web/src/lib/api.ts`,
`web/src/lib/project-agent-usage.ts` (new), `web/src/lib/project-agent-activity.ts`,
`web/src/lib/guided-agent-runtime.ts`, `web/src/components/ProjectAgentJobs.tsx`,
`web/src/pages/ChatPage.tsx`, rebuilt `hermes_cli/web_dist`. Adds rows to the
existing `task_events` table only; no schema migration.

Tests and observed results: `tests/hermes_cli/test_kanban_usage.py` 6 passed;
`plugins/ultimate-builder/tests/test_project_runs.py` 29 passed; web
`npm run check`: typecheck clean, 419 tests in 52 files passed, lint 0 errors
(31 pre-existing warnings). A live Studio journey with a running worker was not
exercised in this change.

Compatibility / restart: restart Lyra and reload Studio (web bundle rebuilt).
Workers launched before the restart run old code and report usage from their
next run onward.

Rollback / retained recovery data: revert the commit; `usage` event rows are
inert to older versions and may remain.

Local commit / authorized push: local commit; no push requested.
