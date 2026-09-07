# Small, visible development jobs — 2026-09-07

User problem and reproduction:
Lyra accepted an automatically generated job named “Implement all remaining
requirements”. It consumed all 90 worker iterations while completing only one
part of a large task graph. Studio then hid the blocked job from Agent Activity
and showed only the broad Development phase, making saved partial work look
stuck.

In scope / explicitly deferred:
Materialize a project's existing task graph as bounded development jobs, retain
their dependencies, show the exact current/blocked work item, and explain a
worker-limit stop in plain language. Do not rewrite or resume a user's active
project jobs, change the underlying Hermes iteration limit, or push generated
projects.

Acceptance criteria:
- A valid multi-item `task-graph.md` produces one saved job per bounded unit.
- Task dependencies and later phase gates are preserved.
- Invalid or cyclic task graphs fail safely instead of becoming one broad job.
- Studio shows running and attention-needed work with the exact unit name.
- Iteration exhaustion is presented as a saved continuation, not a vague error.
- Legacy phase jobs and projects without a multi-item graph remain compatible.

Affected modules and data:
`plugins/ultimate-builder/project_work_units.py`, project-run scheduling/state,
Studio activity presentation, coordinator/planner guidance, tests, code map,
and release metadata. Existing Kanban rows and project files are read only.

Tests and observed results:
- Focused work-unit, saved-run, progress, and decomposer tests: 55 passed.
- Ultimate Builder plus related Kanban lifecycle suite: 127 passed.
- Lyra release/version checks: 9 passed (543 unrelated tests deselected).
- Studio typecheck and 395 browser-unit tests passed; lint completed with no
  errors and 31 pre-existing warnings outside this change.
- Production Studio build completed, and the maintained file index passed its
  generated-file check.

Compatibility / restart:
No database migration. A Lyra restart is required to load the scheduler and
rebuilt Studio assets. Existing active jobs continue unchanged.

Rollback / retained recovery data:
Revert the Lyra commit. Existing project commits, task evidence, and Kanban
history remain intact.

Local commit / authorized push:
Authorized by the user. This record and Lyra application changes are included
in the release commit; generated projects remain excluded.
