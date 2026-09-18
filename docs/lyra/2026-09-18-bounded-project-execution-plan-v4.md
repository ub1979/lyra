# Lyra bounded project execution plan — revision 4

Date: 2026-09-18. Status: proposed from the real Pocket Tasks Trial 3 failure.
No product code is changed by this document. It complements revision 3 rather
than replacing its already-implemented UI, evidence, profile-to-QA, context and
usage work.

## Problem in plain language

Personal projects currently get a small Requirements process and small QA, but
Development still receives the full specialist procedure. If no task graph
exists, the scheduler falls back to one giant “Development” job. That job has a
90-call inner model budget, so it can spend the whole allowance planning,
loading instructions and inspecting its own work before it produces a finished
application. Trial 3 proved that exact path: 90 calls, partial files, then a
recoverable exhausted task.

Enterprise must not use one giant job either. It may receive a larger allowance
per *bounded* work item, never a larger allowance for “build the whole app.”

## Non-negotiable invariants

- Requirements approval, preview approval, and final delivery are separate
  user decisions. “Use smart defaults” may resolve missing requirements; it
  never silently approves a visual preview or queues code.
- Development is queued only from a bounded work-item map. A missing or
  malformed map is an honest `needs planning` state, never a broad fallback.
- The selected profile controls the entire execution shape: requirements,
  development, QA, worker budget and user-visible explanation.
- A worker must preserve partial work and write a small factual handoff before
  any budget exhaustion. A retry receives only that unfinished item.
- The long-lived gateway remains the only Kanban dispatcher. Studio must report
  its availability; it must not start a competing scheduler.
- Existing Hermes memory, complete skills, Kanban task/retry/evidence records,
  project Git isolation, cache-stable conversations and QA recovery remain.

## Slice A — enforce preview approval before Development

**User-visible result:** after a UI preview, Lyra shows an explicit **Approve** /
**Change** /
**Skip preview** choice. Development cannot start until that exact checkpoint
is answered.

**Design:** reuse the existing typed clarification request-ID transport for the
answer UI and reconnect handling. Add a small Ultimate Builder approval-state
adapter at the scheduling boundary; it records a workspace identity, checkpoint
kind, preview revision/digest, request ID, answer and timestamp. The answer is
written by the trusted gateway response path—not by model prose, a ledger word,
or a file the model can edit. `project_run` verifies the current approved/skip
record before accepting `sw-developer` queueing. Requirements approval cannot
satisfy this check; stale, different-workspace and changed-preview answers fail
closed with a plain explanation.

**Affected areas:** `tui_gateway` typed-answer handling, a focused plugin
approval-state module, `project_run_tool.py` / `project_runs.py`, and the Studio
checkpoint renderer. The storage choice is made only after tracing the existing
answer persistence path; no separate settings store, lock protocol, or schema
migration framework is introduced.

**Tests:** real temporary session answer → persisted checkpoint → queue allowed;
missing/rejected/stale/different-workspace answer → queue refused; reconnect
retains an outstanding request without duplicating it; a model-written
requirements/preview file cannot bypass the gate.

**Commit/push:** one change record, focused test suite, local commit, patch
release and authorized push only after checks pass.

## Slice B — create bounded Development work before queueing

**User-visible result:** Lyra says what small piece is running, writes a first
progress record when it begins, and never reports a broad job as started.

**Design:** extend the existing `project_work_units.py` parser rather than add
a new scheduler. Requirements produces a compact Personal work map alongside
the approved brief: 2–4 dependency-linked headings, each with a concrete
acceptance result and one test/verification step. It is not the full
`task-planner` programme and does not add an extra user interview. Reusable and
Production retain their existing planner-produced graph.

Queueing `sw-developer` requires this map. For legacy projects without a map,
return `needs planning` with the exact missing path; do not create the old
whole-phase task. The existing map parser, Kanban dependency links, task
evidence, task comments, retries and completion logic continue to own execution.

**Important compatibility:** already-running and completed legacy broad jobs
are never rewritten. An already exhausted broad job can be converted only by a
new explicit recovery action that records the generated map and preserves the
old task as history.

**Tests:** valid Personal map creates 2–4 sequential/safe jobs; no map and
one-heading map refuse Development; a malformed dependency map refuses without
creating tasks; legacy graphs and completed jobs retain their current shape;
an exhausted broad job creates only bounded replacements after explicit retry.

**Commit/push:** separate from Slice A.

## Slice C — make the developer contract profile-aware

**User-visible result:** a Personal worker moves from “I am planning” to an
early runnable core path, then verifies it. It keeps quality where it matters
without pretending a small local app is a production programme.

**Design:** pass the already selected build profile into Development's task
body and worker context. Add a narrow Personal branch to the existing
`sw-developer` workflow, not a duplicate developer skill:

- reuse approved requirements and preview;
- build only the assigned work item and its stated acceptance criteria;
- write focused tests or the approved browser test page;
- run one relevant browser journey per completed UI item, not repeated
  screenshot/vision loops during planning;
- retain module boundaries, input validation, local Git commits and factual
  evidence;
- defer production-only design ceremony, release engineering and unrequested
  documentation to Reusable/Production profiles.

Reusable and Production keep the full specialist contract. Profile wording is
additive and does not mutate a running worker's prompt or historical session.

**Tests:** generated worker body includes the correct profile contract;
Personal does not request production-only artifacts; Reusable/Production retain
their existing instructions; a worker cannot use the Personal shortcut when
the saved project profile is larger.

**Commit/push:** separate from Slice B, because behavior/prompt changes need
their own live trial.

## Slice D — bound actual inner work and preserve a handoff

**User-visible result:** a worker stops with useful saved progress rather than
burning a large generic call limit and retrying from the beginning.

**Design:** add one explicit per-task inner iteration limit to the existing
Kanban task record and pass it through the existing worker CLI `--max-turns`
mechanism. This is distinct from the existing outer `goal_max_turns` and makes
the budget that actually governs the initial conversation visible in task
status. Do not add another worker runtime or scheduler.

Initial ceilings, measured and adjustable only through a documented project
profile policy:

| Profile | Budget per bounded work item | Purpose |
|---|---:|---|
| Personal | 24 calls | A small slice plus its focused verification |
| Reusable | 60 calls | A normal feature slice with broader checks |
| Production | 180 calls maximum | A deliberately planned complex item, never a whole application |

Before exhaustion, the worker contract writes a task comment/evidence handoff:
current commit, files, completed acceptance criteria, failing command/output,
and next bounded command. The retry path loads that handoff and refuses an
unchanged broad legacy job. A real failure remains a failure; no automatic
success claim or automatic infinite retry is added.

**Tests:** task-specific CLI budget overrides global 90; all three profiles map
to their documented ceilings; exhaustion produces a fenced handoff and leaves
the task recoverable; retry inherits verified partial work but cannot repeat an
unchanged whole-phase card; old tasks without the field retain today's default.

**Commit/push:** separate from Slice C, with migration/old-row tests and one
isolated real worker spawn.

## Slice E — truthful dispatcher availability and progress

**User-visible result:** after queueing, Studio says either “worker started”,
“queued; gateway will pick it up”, or “cannot start because the background
service is not running.” It also shows the first-file/progress milestone—not
only a heartbeat.

**Design:** reuse `hermes_cli.kanban._check_dispatcher_presence()` and the
existing wake marker/status result. Include that diagnostic in `project_run`
state and render it in the existing project-job panel. The gateway remains the
sole dispatcher. Record work milestones from existing evidence/task comments;
do not treat a PID or heartbeat as meaningful implementation progress.

**Tests:** dashboard-only isolated profile reports no dispatcher honestly;
long-lived gateway lock holder picks up a ready task after wake-up; status moves
from queued to running only after claim/spawn; first file/evidence becomes a
visible milestone; no duplicate dispatcher or duplicate worker appears after
reconnect.

**Commit/push:** separate from Slice D.

## Required verification before calling this reliable

1. Unit/integration tests for each slice, `diff --check`, typecheck/lint and
   generated-asset checks where sources require them.
2. One isolated gateway-backed Personal Todo journey: explicit requirements and
   preview approvals, automatic dispatch, visible first-file milestone, complete
   work items, smoke QA, and independent direct browser acceptance.
3. One isolated gateway-backed Production journey with a real task graph: no
   broad Development task; 180 is available only per bounded item; retry uses a
   handoff rather than redoing prior accepted work.
4. Repeat the Personal journey cleanly once. Passing two journeys is workflow
   evidence, not a universal reliability guarantee.

## Explicitly deferred

- A dashboard-owned scheduler, a versioned settings store, cross-tab locks,
  broad worker-kill redesign, automatic agent swarms, and a new QA architecture.
- Increasing the old global 90-call limit. The task-specific budget replaces
  that unsafe blanket approach for new Lyra project jobs; normal Hermes chats
  and unrelated workers keep their existing configuration.
