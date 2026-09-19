# Tiny Notes follow-up repairs — 2026-09-19

## Authority and scope

The user approved the reviewed focused plan and reserved the live application
journey for their own testing. Implement and verify locally, one commit per
stage. Do not restart the user's processes, change their provider/configuration,
repair generated projects, push, or claim a new live acceptance pass.

Evidence: [frozen Tiny Notes trial](../2026-09-19-focused-qa-notes-e2e.md).
Starting candidate: `a1b7a2581`, version 0.19.64 beta (unpublished).

## Stages and invariants

1. Browser dialogs: reproduce the local backend's native confirm path, reuse
   existing agent-browser dialog operations and preserve pending-dialog output.
   Existing CDP routing, explicit accept/dismiss, task isolation, redaction and
   unsupported-backend errors must remain intact. No automatic destructive
   acceptance, global browser restart or extra browser implementation.
2. Coordinator usage: reconcile saved lifetime usage with runtime reporting;
   do not change billing writes, prompt context or worker accounting. Cover cold
   restart, next turn, reconnect, unknown values and session isolation.
3. QA acceptance: distinguish finished work from verified project acceptance.
   Use the builder's existing reporting/task mechanisms, not another LLM judge
   or scheduler. Missing required coverage means needs review with an actionable
   recovery path. Functional completion must not deadlock Experience; existing
   campaigns and reports remain usable. Evidence presence is not truth proof.
4. Preview copy: name the validated registered preview(s), not a hard-coded
   index.html. Leave trusted approval and digest checks unchanged.
5. Diagnostic delays: investigate repeated fresh-diagnostic waits. Change only
   a reproduced cause; retain stale-diagnostic protections and healthy-server
   behaviour. Record any remaining uncertainty explicitly.

## Change safety and tests

Each stage records its exact implementation, impact, regression results and
rollback below before a local commit. New helpers/tests stay under 400 lines;
large existing files receive thin integrations only. Run behavioural unit and
real temporary-filesystem/SQLite/browser checks as appropriate through the
canonical runner. No paid model calls or end-to-end generated project journey.
Preserve unrelated untracked user files. Rebuild generated assets if affected;
regenerate the tracked-file inventory. No schema/data migration is planned.
Rollback uses focused revert commits; saved chats, usage, jobs and projects are
retained. Running processes need an intentional later restart to load changes.

## Results

### Stage 1 — local browser dialog recovery

The actual installed agent-browser 0.26.0 CLI provides dialog operations, but
a click waiting on confirm occupies its command queue: subsequent snapshot and
dialog commands also wait. A real disposable-page probe reproduced this before
the fix. The existing CDP supervisor offers the required independent connection.

Local navigation now discovers the same task-owned browser's loopback endpoint
and attaches the existing supervisor to the exact navigated page. This matters:
Chrome also has a spare new-tab page; the old first-page selection observed the
wrong target. Local supervision uses native dialogs without the cloud-only XHR
bridge; existing remote defaults are unchanged. Task --session routing stays
unchanged. A pending dialog releases only the waiting CLI client, not the browser
or worker, and is preserved in tool responses. Subsequent page operations return
the dialog instead of entering the blocked queue; accept/dismiss uses the same
task/sidecar supervisor. No automatic acceptance or raw-CDP schema expansion.

Verification: 198 tests passed across ten browser suites, including eight new
tests and three real local-browser cases (accept, cancel, prompt, subsequent
navigation, wrong-task/stale-dialog rejection). Real clicks return the pending
dialog within the test's 10-second bound; the whole local suite took 8.5s.
Existing CDP, hybrid routing, private-page guards, console, Lightpanda and
deadline tests passed. Ruff and diff checks passed. Initial integration tests
failed on wrong-page attachment; that failure was fixed, not relabelled. Test
cleanup uses exact UUID-owned daemon identity, with pytest's explicit daemon
cleanup allowance. No application journey or user's running process was used.

Compatibility: older CLIs without endpoint discovery remain navigable but cannot
gain local dialog recovery; the dialog tool reports an unavailable supervisor.
The new capability is picked up on a fresh agent process; no live toolset or
historical prompt is rewritten. Revert this stage to restore old browser paths;
there is no persisted data migration.

### Stage 2 — coordinator lifetime usage across restart

Gateway agent construction snapshots persisted usage before any new calls.
Display events add only that fixed baseline to the new agent's runtime counters.
They do not add a growing database total, seed billing counters, rewrite prompts,
or modify per-call persistence. Unknown persistence omits lifetime numbers rather
than claiming zero; context occupancy and worker totals remain separate.

An actual SQLite regression exposed a second read-path defect: the existing
compression-lineage helper excluded branches but not delegated/tool children.
It could select a worker as the parent's continuation. The helper now uses the
same exclusions as the existing live-compression-child lookup. No stored rows or
write semantics change; lineage exports also stop absorbing independent workers.

Verification: 565 tests passed across ten gateway/state suites (including all
461 SessionDB tests). Six new regressions cover SQLite close/reopen, the next
turn, repeated reconnects, independent chats/workers/branches, actual compression
publication, live compression followed by resume, unknown reads, context-window
separation and construction wiring. Billing counters and stored deltas are
asserted unchanged. Ruff passed. Revert the display helper/wiring and read-only
lineage correction to roll back; no migration is needed.

### Stage 3 — final QA coverage, distinct from worker completion

Only newly created focused final-QA jobs receive a small pinned contract in
their existing job body: requirement IDs/digest and a unique JSON report path.
The final worker fills the supplied criterion/status/evidence template. No new
tool, judge, scheduler, schema, settings store or task-completion veto was added.
The contract cannot change on reopen; a fresh pass gets a fresh report path.

The read-only builder status checks missing/non-PASS rows, changed requirements,
missing revision notes, malformed reports and unavailable/outside-project
evidence. Shared evidence is inspected once per poll with bounded file counts.
Incomplete coverage becomes needs-review in the phase map and project-run
summary, even when a Markdown heading says PASS. Worker status remains done.
The recovery message asks for specific gaps to be resolved and a fresh bounded
QA pass, never an automatic retry. Functional completion still unlocks Experience
through the unchanged Hermes dependency mechanism; only final coverage is judged.

This is consistency checking, NOT independent proof of correctness or a security
boundary against falsified evidence. The status explicitly says reported coverage,
and retains the worker's tested-revision notes. It does not assert that a later
source change was retested. Criteria come from explicit ID/requirement tables;
unknown formats require human review rather than guessed obligations or an empty
PASS. Existing jobs without a pinned contract retain their original behaviour.
No historical job body, report, requirement or conversation was rewritten.

Verification: 252 tests passed across 23 plugin/skill/summary suites, including
19 new real-filesystem/SQLite cases: explicit Personal contrast requirement,
omitted/blocked/failed/skip results, contradictory PASS heading, dependency release,
reopen, fresh recovery, stopped jobs, old campaigns, unsafe paths and UI/summary
projection. New helper and tests are 183 and 194 lines. Ruff/diff checks passed.
Rollback: revert this stage; new report files remain harmless evidence and
existing jobs continue through the unchanged Kanban lifecycle.

### Stage 4 — preview copy names the registered artifact

The approval question now names a single validated option's real path. Multiple
options list their actual paths; callers without named options refer only to the
preview directory, not an invented index.html. The token, selected-design
handoff, typed-answer handling and digest fence are unchanged.

Verification: 43 preview authorization/API tests passed, including three new
single/multiple/unregistered custom-filename cases that also assert approval
works and later preview changes invalidate it. Ruff/diff checks passed. Revert
this copy-only stage to roll back; no saved decision or project was changed.

### Stage 5 — actual TypeScript diagnostic wait cause

The installed TypeScript language server reproduced the trial's delay on a
temporary JavaScript file: first clean result and clean-to-clean check each
timed out at 5.000s, whereas error/fix notifications arrived in about 0.35s.
Protocol observation and the installed server's source showed why: it has no
standard document-diagnostic pull capability, drops repeated empty diagnostic
notifications, and Lyra conservatively treats the first push as a seed. Waiting
for another notification cannot produce a verdict for these clean-file cases.

The fix uses that same server's advertised `typescript.tsserverRequest` command
for syntax/semantic/suggestion diagnostics. A 67-line adapter converts only
complete successful responses to standard diagnostic items. The existing client
retains send-time version tags, cancellation, deadlines, seed protection and
stale-result filtering. No empty-result assumption, cache shortcut, timeout
increase, extra server, install, global disable or model tool was added. Other
servers and a future standard TypeScript pull capability keep their prior path.

The real installed-server probe used the repository's installed TypeScript SDK
explicitly because the temporary workspace has none; this matches the SDK
resolvable by the trial project under this checkout. No user's configuration or
project was edited. After the fix: new clean file 0.281s, unchanged clean 0.005s,
syntax error 0.004s (correct error retained), fixed file 0.003s. These are local
component timings, not a claim about whole-project or model response latency.

Verification: all 176 LSP tests pass, including 11 new cases for real stdio,
synchronous service/baseline/delta integration, error→fix, malformed/missing
results, in-flight edit races, capability selection and deadline preservation.
The first sandboxed run could not inspect test-owned subprocesses during cleanup;
rerunning with process inspection available passed without weakening the guard.
Ruff and Windows-footgun checks pass for every new file.

The broader file-tool run has three unchanged macOS test failures: literal
`/tmp` mock expectations versus normalized `/private/tmp` paths. Confirmed the
identical three failures (48 pass / 3 fail) in an isolated checkout of the
pre-repair commit `a1b7a2581`. They are not claimed green or fixed by this stage.
Revert this stage to restore the old pull path; no data migration is needed.

### Verification boundary

Web: typecheck, 491 tests and build passed; lint reports 0 errors / 30 existing
warnings. The rebuilt tracked assets are unchanged. No live Studio journey,
service restart, provider change, version bump or push was performed. The user
will run the application acceptance journey after intentionally restarting idle
Lyra processes to load these commits. A browser reload alone does not replace an
already-running Python agent. Start fresh work for the new QA contract; do not
expect historical completed jobs to acquire it retroactively.
