# Project job routing and visibility

Hello's build-planning job was saved with a specialist ID as its worker profile.
That profile did not exist, so Hermes correctly left the task for an external
worker. Studio hid the job because its idempotency key was not Lyra-generated.
The chat then incorrectly described queued work as running.

Scope: include every job with the exact project workspace in Studio; preserve
generic jobs independently of managed phases; report assignments that cannot
auto-start; reject nonexistent profiles in Lyra's phase queue; distinguish
queued from running. Keep Hermes external-worker lanes valid and unchanged.
Correct the one confirmed Hello assignment using the audited Kanban assign
action, retaining its body, ID, skills, model/provider settings and history.
Reconnect that job's updates to the existing Hello chat using the established
TUI notification subscription, which was absent on the raw-created job.

Acceptance: the existing job starts on the configured default profile, generic
jobs remain visible after reload, unavailable assignments need attention,
different projects stay isolated, and queue validation writes no partial jobs.
Tests cover real SQLite creation/lifecycle plus Studio status presentation.

No schema migration or new model tool. Revert code to roll back presentation;
the assignment recovery is recorded in the job event history. Local commit only.

Verification: 54 builder/backend tests and all 370 web tests passed. TypeScript,
web production build, web lint and focused Python lint passed. The fresh
project-run CLI shows Research and Architecture completed and the generic build
job running. The actual gateway spawned its worker at 00:08:51 BST; later saved
heartbeats and its work log confirm continued activity. This is worker-start
verification, not a claim that the build plan or application is complete.

The dashboard caches its project module. Restart Lyra after current work can
safely stop, then refresh Studio to activate the display change. The current
launcher stops its owned gateway on dashboard exit, so it was deliberately
left running while the recovered job works. Updated guide instructions apply
when loaded normally; no live conversation prompt/cache was rewritten.
