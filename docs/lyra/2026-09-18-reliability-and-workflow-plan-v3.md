# Lyra reliability and workflow plan — revision 3

Date: 2026-09-18. Status: initial code slices implemented locally; live acceptance
and release sign-off remain open. The user will run the end-to-end journeys.
Supersedes [revision 2](2026-09-18-reliability-and-workflow-plan-v2.md), which
remains the detailed reference. Evidence is in the [comparison report](2026-09-18-end-to-end-comparison-report.md)
and [trial log](END_TO_END_ACCEPTANCE.md). The linked change records track the
product-code slices; this plan is the acceptance contract, not proof of a live pass.

## Goal and boundaries

Make a small MVP workflow fast, visible and honest while preserving Hermes
memory, complete skill instructions, durable jobs, recovery and the current
approval boundaries. The first pass deliberately avoids a new settings database,
cross-process selection protocol, or QA architecture redesign.

The UI remains the authority for profile and agent choice. Lyra may explain a
risk, but cannot silently add roles or approve its own team. A user may permit
simple defaults; that permission should be acknowledged visibly before planning.

Implementation boundary: the selected profile currently travels through the
Studio setup seed and workspace-scoped browser storage into `project_run`. The
queue validates the value and preserves an existing QA task shape, but no
server-side immutable selection record was added. The live acceptance run must
check that Lyra actually passes the selected profile; a cross-browser mismatch
or model omission remains a reason to revisit the deferred settings authority.

## Implementation order

Each item gets a reproduction, focused behavioral tests, an adjacent-path review,
and a separate local commit. Any eventual push follows the normal single patch
bump and release gates. Do not release a half-wired profile change: items 3 and
4 are one change set.

### 1. Show progress that already exists

Studio must render the gateway's existing `message.interim` events and preserve
ordering with deltas, tool events, completion, replay and reconnect. Interim
text cannot settle a turn, approve work, trigger auto-continuation or expose
reasoning. Final text must not erase or duplicate it. Reuse existing gateway,
Ink and Desktop transport behavior; do not add model calls or synthetic turns.

Acceptance: on a controlled delayed-model browser journey, a receipt/working
indicator appears within 1 second locally and interim text appears within 1
second of its gateway event. There is exactly one final response.

### 2. Make evidence reject masked failures

A deliberately failing test command must never be recorded as passed merely
because `tail`, `tee`, `|| true`, `; echo`, redirection or a quoted pipeline
returned zero. Unknown compound evidence is unverified and requires a direct
rerun. Test the real shell/result path, including supported Windows behavior;
do not globally ban ordinary pipelines or trust old misclassified evidence.

Acceptance: a failing fixture is classified failed or unverified, never passed;
a direct passing fixture remains passed.

### 2a. Investigate latency (runs alongside 1 and 2)

Read-only investigation first: correlate model call start/end, output tokens,
tool calls, loaded playbooks, browser work, interim frames, compression and
approval timestamps. Explain the two pre-approval responses that produced about
33,000 output tokens. Determine whether the playbook or automatic preview work
needs adjustment after progress rendering is restored. Do not change prompts or
workflow based only on the old overlapping comparison run.

Record separate provider time, active work time and user-visible waiting time.
This investigation may recommend a later focused change; it is not itself a
latency guarantee.

### 3–4. Carry profile into Studio and make QA profile-aware together

Carry the existing launcher profile through the Studio setup seed and into the
authoritative project execution request. Keep compatible internal IDs and the
existing UI; do not create a second team picker. Validate that the selected
profile is visible before submission and is the only automatic phase authority.

Make QA stage selection consume that profile. For new projects with no saved
profile, preserve today's four-stage behavior. For an MVP/personal profile,
define a real smoke stage that sets up the app, runs the approved core acceptance
checks and records a verdict; do not substitute the existing setup-only stage.
Balanced/Enterprise retain their currently applicable depth until evidence says
otherwise. Custom follows the explicitly selected roles/scopes.

Change QA completion from the literal `QA-004` rule to selected-stage
completion for new runs. A selected MVP smoke stage can finish QA; an empty or
inapplicable selection is reported honestly, never as passed. Preserve QA-001…
QA-004 identities and recovery semantics for existing runs.

Acceptance: a new MVP queues no unselected enterprise phases and one real smoke
QA stage; QA finishes when that stage passes. A legacy project without a saved
profile still follows its four-stage recovery. Profile and QA choices survive a
reload/resume, and approval pause, browser reconnect and duplicate-submission
fences still work.

### 5. Correct provider-facing context estimates

Audit every preflight estimate call site. Estimate the representation actually
sent to the provider, including system/tools/images and output reserve, while
preserving provider-required reasoning echo, stored history, skills and cached
prefix stability. Do not globally delete reasoning or disable compression.

Acceptance: on the configured provider, the estimate is within an agreed 25%
of actual provider input for representative turns; compression is not triggered
solely by the known stored-versus-projected inflation. Test fallback providers,
tool calls, images, cache reuse and compression recovery.

### 6. Make usage and status truthful

First reproduce the remaining reconnect/unknown case. Keep coordinator and
worker totals separate, scope them to session/task/attempt, deduplicate replayed
events, and render missing data as “unknown/not reported”, never zero. Keep
process liveness distinct from useful activity; this is display/accounting work,
not a new kill-timer design.

Acceptance: a fixture with no worker report displays unknown; a genuine zero is
displayed as zero; coordinator and worker totals never merge; reconnect and a
new conversation cannot inherit prior totals.

### 7. Investigate coordinator overlap before fixing it

Use the trial log and current event/task ownership to determine whether overlap
comes from missing playbook guidance, a duplicate dispatch path, or a tool-level
authority gap. Start with the smallest effective remedy: an explicit workflow
instruction if that prevents coordinator browsing/editing a worker-owned phase.
Use a tool guard only if evidence shows instructions are insufficient. Preserve
worker recovery and do not add a broad scheduler rewrite.

Acceptance: one controlled project has one coordinator, no coordinator edits the
active worker-owned phase, and approval pause/reconnect cannot create duplicate
work. The chosen remedy and evidence are recorded before implementation.

## Verification journey and thresholds

The user will perform this journey after the local changes are delivered. Unit,
integration and build checks cannot substitute for the two clean live runs.
Local verification passed 472 web tests, 140 builder-plugin tests, focused
context/evidence tests, typecheck, lint (warnings only), and the locked-dependency
web build. A wider Python sweep did not pass: 39 tests failed across unrelated
agent/gateway suites, including sandbox-denied writes to `~/.hermes` and tests
dependent on local credentials/configuration. Those failures were not fully
baseline-classified. Clean CI and the live journey remain release gates.

Run at least two clean, independent Pocket Tasks journeys with one coordinator
per project. Verify the unchanged acceptance criteria directly: local browser
task creation, edit/delete, completion toggle, filtering, keyboard-friendly
controls, localStorage persistence after reload, responsive layout, and the
project's automated tests. Do not copy these claims from Lyra's own report.

Each journey must also verify: explicit-default acknowledgement, approval pause,
browser reconnect without duplicate work, selected profile and QA stage, honest
QA completion, deliberately failing evidence, truthful usage/status, and final
committed project state. Record session/task IDs and separate clocks for provider
latency, active work and user waiting.

Required thresholds:

| Check | Threshold |
|---|---|
| Receipt indicator after submit | Within 1 second locally |
| Interim text after its gateway event | Within 1 second |
| Context estimate vs actual provider input | Within agreed 25% margin |
| Clean independent journeys | At least 2 |
| Duplicate project creation after reconnect | 0 |
| Masked failing command classified as passed | 0 |

Passing these checks is evidence for this workflow, not a universal reliability
claim for every generated application.

## Deferred until evidence brings them back

- **Versioned settings store, locks and revision protocol:** return only if the
  existing persisted selection path cannot survive reload, two tabs or a move
  without lost updates; first reproduce that failure.
- **Functional/Experience QA split:** return only if profile-aware MVP smoke QA
  still misses material user-experience defects or users need independently
  selectable coverage. The current plan keeps QA simpler until that evidence.
- **Migration/rollback machinery:** return only when a real schema migration is
  required. Additive compatible records and existing rollback rules remain.
- **Broad scheduler or worker-kill redesign:** return only if the overlap
  investigation reproduces an enforcement failure after explicit instructions
  and existing guards are exercised.

## Engineering rules

One responsibility per new file/class, under 400 lines where practical; reuse
Hermes mechanisms and plugin boundaries. Add behavioral and real persistence/
transport tests, inspect adjacent consumers, preserve complete skills and
prompt caching, regenerate maintained-file indexes when needed, and record
limitations. No application code is changed until this document's first slices
are approved and their change records exist.
