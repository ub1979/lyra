# Functional and Experience QA — 2026-09-19

## Problem and evidence

The calculator's Personal QA already used one job, yet its warm retest took
15m27 at 36 model calls. The 495-line QA skill mixes functional testing,
experience audits, production readiness and reporting; Personal exceptions
override those instructions but do not remove them from the worker's context.
The trace also shows slow inference and generated test-script defects. This
change makes scope explicit; it does not claim to solve those latency costs.

## Scope and acceptance

- Two complete skills: Functional QA and Experience QA, plus a shared evidence
  contract force-loaded through Hermes' existing per-task skills mechanism.
- New Personal QA uses Functional only, including real UI journeys, keyboard,
  narrow layout, errors and persistence. Experience is an explicit opt-in.
- New Reusable and Production QA run Functional then Experience; Production
  adds requirements-driven readiness checks. No new scheduler or core tool.
- One existing `qa-engineer` phase remains the Studio/model-routing identity.
  Only the final selected job may mark that phase complete. Later phases wait
  on all selected QA jobs, and failed parents remain blocking dependencies.
- Previously queued legacy jobs retain their bodies, skills, identities and
  stage count. A small legacy entry skill retains the complete old procedure
  in reference files. No live session prompt is rewritten.
- Skills, new modules and new tests stay under 400 lines. Existing large route
  and coordinator files receive only small integration changes.
- Actual failing commands cannot be described as passed, DOM attributes cannot
  be described as screen-reader testing, and reports name untested scopes.
  These are instructions, not a new runtime enforcement guarantee.

## Impact, compatibility and recovery

Affected: builder plugin skill registration, QA work planning, queue skill
selection, existing project-run tool/CLI opt-in, coordinator instructions and
documentation. Storage schema, chat/PTY, model providers, development jobs,
budgets and worker processes are unchanged. Shared-directory QA stays serial.
Existing jobs are reused unchanged. New jobs use the new skills after the
plugin processes are restarted; no active user process is restarted here.
Rollback is a local revert; retained job evidence and old skill entry survive.

## Verification and delivery

- `scripts/run_tests.sh plugins/ultimate-builder/tests
  tests/skills/test_focused_qa_skill.py tests/tools/test_skill_result_integrity.py
  tests/hermes_cli/test_kanban_worker_spawn_toolsets.py -q`: 245 passed.
- After the fresh-pass identifier correction below, the affected queue and
  focused QA suites passed again: 46 tests, including the fixed-clock expansion
  and subsequent reopen. Contract and skill-delivery checks also passed after
  the final instruction edits.
- `web`: 491 tests passed, typecheck passed, lint 0 errors / 30 existing warnings,
  production build passed. Rebuilt assets are unchanged; no UI source changes.
- Ruff and Windows footgun checks passed; diff whitespace check passed.
- New skills are 95/92/99 lines (Functional/Experience/Evidence); legacy entry
  is 56 lines with complete retained references under 400 lines each. New Python
  modules/tests are below 400 lines. The existing large `project_runs.py` shrank;
  its changes are thin queue integration plus the identifier correction.

The initial control test incorrectly expected dependent `todo` jobs to become
`blocked` when pausing. Corrected it to verify that the ready parent is blocked
and its dependent cannot be claimed. This was a test expectation error.

No live project run or latency claim is part of this implementation check.
Local commit only; no version bump, push, running-process restart or settings
change. Reloading a browser alone does not reload an existing coordinator's
plugin/schema: restart Lyra and use a new coordinator session for the new opt-in.
Existing saved jobs deliberately retain their previous scope.

### Fresh-pass identifier correction found during verification

The first broad check passed (245 tests), but a follow-up exposed a real timing
edge in the existing queue: `int(time.time())` plus PID was the run token, so a
completed job and an explicit `force_new` request in the same second shared an
idempotency key. Hermes correctly returned the old job, defeating the new QA
scope and retaining its former final-item instruction. Use a UUID for each new
queue batch. Ordinary reopen still resolves existing work-item identities first.
This also covers the shared new-job creation path for other phases; no saved
keys are changed. A fixed-clock regression checks fresh parent, dependency gate,
retained original body, and subsequent reopen adopting the fresh tasks.
