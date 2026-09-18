# Lyra reliability and workflow plan — revision 2

> Superseded by [revision 3](2026-09-18-reliability-and-workflow-plan-v3.md).
> Retained as the detailed reference and deferred-design catalogue.

Date: 2026-09-18. Status: proposed implementation specification.
Supersedes [revision 1](2026-09-18-reliability-and-workflow-plan.md).
Evidence: [reviewed report](2026-09-18-end-to-end-comparison-report.md) and
[trial log](END_TO_END_ACCEPTANCE.md). This change updates documents only.

## 1. User decisions and corrections

- Project setup belongs in the UI: MVP/Fast, Balanced, Enterprise, or Custom.
  The confirmed team controls execution. Lyra can explain a missing capability
  and request a change; it cannot approve that change itself.
- Requirements remains available. Ask useful questions when answers are
  missing; honor the user's permission to choose defaults. Keep requirements
  and visual-preview approval boundaries. A small build need not skip discovery.
- QA becomes two independently selectable options: Functional QA and Experience
  QA. Users may select either or both. Custom may omit independent QA, with
  coverage clearly marked as not selected; developer tests still apply.
- Preserve the current UI, Hermes memory/learning, durable Kanban work, and
  complete skill instructions. “Bano” was chat shorthand, not a product rename.
- The six-minute planning interval was not proven waste. The assistant wrote
  interim progress messages that Studio currently does not handle. Reuse those
  events before adding model turns or rewriting the requirements process.
- The old comparison had two coordinator sessions launching workers into the
  same workspace after 12:35. Its later timing/output is not a clean benchmark.
  Background skill-review activity was Hermes learning, with bundled-skill
  writes rejected; it is not proof of QA changing its rules during testing.

## 2. What users select

The existing launcher already has templates, a size picker and agent checkboxes.
Consolidate their behavior; keep existing IDs `personal`, `reusable`, and
`production` as compatible internal values for the new display names.

| Preset | Initially selected roles | QA defaults | Work depth |
|---|---|---|---|
| MVP / Fast | Requirements, Development | Functional | Approved core scope, concise artifacts and run instructions |
| Balanced | Requirements, Development, Code review, Documentation | Both | Full approved user flows, focused error handling and maintainability |
| Enterprise | Requirements, Architecture, Task planning, Development, Code review, Security, Documentation | Both | Approved production requirements and applicable operational risks |
| Custom | User edits a visible preset or selects roles directly | User selects | Explicit inherited size, editable before confirming |

These are proposed defaults, displayed before the user confirms. Architecture
can be added to Balanced. Research, design, deployment and other existing roles
remain selectable. Enterprise does not authorize remote deployment, publication
or paid services. A preset is never a command to invent extra requirements.
Changing its role list shows “Custom, based on [size]”; it does not silently
change size. Requirements stays available under the existing contract.

There is no new conversational team-picking step after the UI is confirmed.
An assistant recommendation opens an editable proposal only. The saved choice
changes only after an explicit user action in the existing UI.

### Functional QA — does it work?

Owns acceptance behavior, automated tests, valid/invalid inputs, persistence,
relevant integrations and failure recovery. For UI applications it must exercise
the core flow in the real browser even when Experience QA is not selected.
MVP depth covers the approved core features, relevant failure cases and saved
state; it does not invent production scale/load/deployment checks.

### Experience QA — can people use it comfortably?

Owns the approved design match, responsive layout, clear labels/errors/empty
states, navigation, keyboard/focus behavior and applicable accessibility checks.
It uses the actual interface. It records obvious functional blockers but does
not repeat the full functional campaign or claim that it verified all behavior.
For a CLI it checks the human-facing commands/help; for an API/library without
a human interface, show the option as inapplicable rather than running a fake
visual audit. Baseline development accessibility and correctness obligations
do not disappear when this independent review is unselected.

### Independent execution and honest completion

- Keep the existing `qa-engineer` capability and model/provider assignment.
  Pass a validated scope (`functional` or `experience`) to a separate job for
  each selected option. Avoid a duplicate agent runtime or scheduler.
- Extract common QA evidence/recovery instructions once. Each scope loads its
  complete relevant playbook; no 8,000-character truncation or partial reading.
- Each scope can set up its own test environment and produce its own verdict.
  Neither requires the other to run first. When both are selected, schedule
  them serially in a shared workspace and reuse valid setup/test evidence.
- Give reports separate paths, e.g. `.sdlc/qa/functional.md` and
  `.sdlc/qa/experience.md`, recording revision, relevant dirty-file identity,
  commands, results, limitations and findings. Recheck evidence after repairs.
- Per-scope states: pending, running, passed, failed, blocked, not selected,
  or inapplicable with a reason. Unselected never means passed.
- The plugin derives the combined coverage summary from selected scope results
  for the same delivery revision. No third LLM job is needed just to combine
  verdicts. Existing `bug-report.md` readers get a compatible combined report.
- “Selected QA complete” requires every selected applicable scope to pass.
  A functional-only result says “Functional QA passed; Experience QA not
  selected.” With neither selected, say “Developer checks completed;
  independent QA not selected.” Never claim comprehensive verification.
- Blocking findings return to the selected Development role for a bounded
  repair. A separate Debugger remains optional. Retest invalidated scopes;
  retain evidence for unaffected checks. The coordinator does not repair apps.
- A scope exhausting its existing budget saves a handoff and resumes through
  Hermes recovery. Do not silently raise limits, restart its entire campaign,
  or load all four old QA stages into a single nominally small job.

## 3. Persisted choices, authority and compatibility

Implement a small plugin-owned settings adapter; `project/register` currently
prepares Git and does not provide this store. Use profile-scoped data under
`get_hermes_home()/ultimate-builder/project-settings/`, keyed by canonical
workspace path. Reuse existing file-lock and atomic-write utilities. Keep
selection authority outside generated project documents; a Project Brain or
worker report is never approval to add agents.

One versioned record contains workspace, schema version, selection revision,
build size, preset/custom identity, approved role IDs, selected QA scopes,
model/provider overrides, and policy version. UI writes carry the expected
revision. Under a per-project cross-process lock, validate and atomically save;
reject stale updates with the current record rather than overwriting another
tab's choice. Browser localStorage is only a display cache. Invalid records
leave the last valid selection intact and explain the error.

Expose settings through the existing authenticated plugin API, with a narrow
CLI equivalent for explicit user setup. Do not add a model tool to approve its
own team. This is an application-level boundary, not an OS sandbox against
workers with arbitrary shell access; preserve existing workspace/role guards.

Queue creation takes the same lock, validates the current selection revision,
then commits tasks plus a compact approval snapshot through existing Kanban
transactions. Record role, QA scope, policy/selection revision and model routing
in the task's existing instructions/event data. Release the settings lock after
the task commit; request dispatch only afterward. Establish and test a single
lock order: project settings before board writes. Existing task identity/run
fencing remains authoritative for duplicate calls and retries.

| Change or recovery | Defined behavior |
|---|---|
| New project | Save confirmed choices before chat submission; show save failure and do not start inference |
| Chat clear/reload/new device in same profile | Read server settings; retain size/team and QA choice |
| User edits size/team during work | Applies to newly queued work; show that existing queued/running jobs keep their approved snapshot |
| User removes an active role | No new jobs for it under the new selection; existing jobs continue unless explicitly paused/stopped |
| Retry/resume of an existing approved job | Keep original scope/snapshot and dependency/review gates; never treat retry as approval for new work |
| Model change | Keep current project routing behavior, but explicitly test and document application to queued jobs versus already running attempts |
| Legacy project with no saved selection | Existing work can complete/recover; require one UI confirmation before new automatic phase creation |
| Project move/trash | Extend existing relocation handling for settings and snapshots; retain recoverable records and surface partial failures |
| Malformed/unavailable settings | No newly authorized work; status, pause and stop remain available |

For old jobs, preserve `qa-engineer` identities and QA-001…QA-004 dependencies.
Do not reshape a running campaign. New scoped QA jobs use distinct versioned
identities, so they cannot reuse an old partial QA result as a scope pass.
The profile/role guard belongs in shared plugin queue/retry paths, covering
tool and CLI callers. Generic Hermes Kanban behavior remains unchanged.

## 4. Implementation slices, in order

Each slice gets a problem/reproduction record, affected-path review, behavioral
tests, and a separate commit. Any pushed change set gets its own single patch
bump and matching release metadata/assets. Profile slices below form one
dependent feature: hold their release until UI → saved choice → queue → final
report passes together; separate commits do not justify a half-wired release.

### A. Display the progress messages Hermes already emits

Affected: Studio event reducer/state/merge helpers, thin `ChatPage.tsx` wiring;
existing gateway, Ink and Desktop handlers supply the transport contract.
Capture real `message.delta`, `message.interim`, tool and completion frames.
Present interim text once, honor `already_streamed`, and preserve ordering.
Keep receiving/working feedback while the model has not produced text.

An interim message must never settle the turn, execute phase markers, approve
an agent, or trigger auto-continuation. Final completion must not replace prior
interim segments. Strip internal control markers from display. Do not expose
reasoning events as progress prose. Reuse the current conversation history;
avoid new model calls, synthetic user turns, or cached-prefix mutations.

Tests: streamed/non-streamed text, duplicate frames, several interim segments,
final answer, cancellation, reconnect/replay and approval waiting. Browser test
with a delayed controlled model: receipt status within 1 second locally, visible
interim text within 1 second of its event, exactly one final answer. Separately
measure real-provider time; rendering cannot guarantee fast model generation.

### B. Make test evidence trustworthy

Affected: `agent/verification_evidence.py`, its completion consumer and narrow
terminal-result integration if needed. Reproduce failed tests piped to `tail`
returning shell success. Accept pass evidence only when the actual test status
is established; uncertain compound commands are unverified, not guessed passed.
Do not globally change shell behavior or ban ordinary pipelines.

Test real commands with pipefail on/off, quoted pipes, `tee`, `|| true`,
`; echo`, redirection, successful direct tests, background completion and
supported Windows behavior. A string containing `pipefail` is not proof it was
active. Record explicit uncertainty and require a direct rerun before sign-off.
Do not silently trust matching old evidence that was classified incorrectly.

### C. Preserve and expose the user's project selection

Affected: builder launcher source/bundle, plugin registration/settings API,
Studio setup parser/seed and existing team/model preference UI. Use the record
and rules above. Remove the reconstructed “no build size selected” instruction
when a saved choice exists. Serve preset definitions from one plugin policy
source; both launcher and chat consume it. Keep old IDs compatible.

Tests: actual launcher → API → first prompt, profile and QA selection survive
reload/clear/resume, two tabs with stale revisions, invalid input, failed save,
custom teams/model overrides, moved projects and old localStorage. Opening an
empty project must still make zero model calls until the user submits intent.

### D. Enforce selection in the existing dispatch path

Affected: `project_runs.py`, `project_run_tool.py`, CLI adapter, retry adapter
and the new small settings/policy helpers. Validate all requested roles/scopes
before any task creation. Agent-written prompts or selection files in the
workspace cannot grant extra roles. Block disallowed additions with a plain
message and the existing team-edit UI. Preserve status/pause/stop access.

Tests: real SQLite, CLI/tool parity, permitted/blocked batches, zero partial
creation on rejection, stale selection during queue, retry snapshots, duplicate
submissions, worker/delegated-child denial, cross-project/profile isolation,
crash after task commit and safe repeated dispatch. Include reconnect from two
tabs to ensure one user submission cannot create overlapping duplicate work.

### E. Introduce the two QA scopes and their completion rules

Affected: work-unit policy and job-body helpers, QA skill/reference sections,
workflow contract, phase ordering/progress, evidence/report aggregator,
notification summaries, UI QA choices and usage attribution. Retain
`qa-engineer` as the capability with the existing assigned model for both scopes.
Avoid adding a new core tool or nesting QA workers.

Replace the new-run assumption that only literal `QA-004` can finish QA with
selected-scope completion. Keep the legacy rule for legacy campaigns. Separate
the functional checks from UX/design gates throughout the loaded playbook;
changing job counts alone will not stop full-campaign instructions from firing.
Existing design grades apply to selected Experience QA only. Basic feature
correctness and developer tests remain required in every development project.

Tests: Functional only, Experience only, both, neither in Custom, non-UI scope
applicability, each preset's exact roles, new scope completion, old four-stage
resume, same-scope retry, later adding a scope, revisions after repairs,
different-scope results not overwriting each other, contradictory/absent
reports, no duplicate final notifications, no double-counted usage. Simulate
budget exhaustion: retained evidence resumes without setup repetition.

### F. Correct context estimates using the outgoing provider representation

Affected: preflight request estimation and the existing message projection
helpers. The measured 156k-versus-35k reconstruction excludes system/tools and
is evidence of inflation, not exact wire accounting. Reproduce against the
actual outgoing representation before choosing the narrow extraction.
Use one side-effect-free projection for estimation and request construction
where practical. Preserve stored history, reasoning echo for providers needing
it, API-specific content, tool schemas, image costs and output reserve.

Tests: custom GLM, echo-required providers, strict providers, fallback/model
switch, cached prefix stability, images/tool calls, plugin context engines,
genuine near-window pressure, failed compression recovery. Audit every preflight
estimate call site to avoid fixing only the first-turn path. Compare compression
frequency and cache hit rate; do not disable compression or shorten full skills.

### G. Correct remaining usage and activity display defects

First reproduce on the current candidate: worker accounting already exists,
so do not reimplement past fixes. Trace known totals becoming unknown on
reconnect. Scope cached totals to session/task/attempt identities; a new
conversation must never inherit the previous one's counters.
Keep coordinator and project-agent totals clearly named. Show freshness and
unknown coverage, deduplicate late/replayed snapshots, and label process
liveness separately from useful model/tool activity. This is display work;
it does not introduce new worker-killing timeouts.

Tests: partial reporting, genuine zero, retry attempts, late snapshots,
reconnect versus intentional new conversation, two QA scopes, model changes,
idle worker and terminal status. Use existing event/usage storage and polling.

## 5. Engineering and release rules

- New files/classes have one responsibility and stay below 400 lines. Extract
  focused policy/storage/rendering helpers from large existing files; avoid a
  broad rewrite. Keep plugin-specific decisions at the plugin boundary.
- Explain invariants and non-obvious recovery behavior in comments. Behavioral
  tests exercise real persistence/transport paths, rather than matching source
  strings or counting declarations. Preserve complete skill loading and cache.
- Test each slice against adjacent consumers. In particular: launcher selection
  affects prompts/queue/recovery; QA scopes affect skills/verdicts/notifications;
  interim display affects reply merge/approval/auto-continue; context estimates
  affect every provider; evidence classification affects completion gates.
- Run focused suites through repository test tooling, relevant lint/typecheck,
  build generated assets, and verify a clean candidate with the Studio smoke.
  Regenerate the tracked-file inventory when the maintained file set changes.
- Before rollout, run an MVP with explicit defaults, a Balanced project with
  requirements questions, and a small Custom Experience-only case. Verify final
  app behavior, selected coverage, meaningful progress, no unapproved roles,
  worker retry, browser reconnect, and retained profile after restart.
- Use one coordinator per test project; log session and task IDs. Record user
  waiting time separately. Measure progress arrival and useful work, not merely
  test counts. Enterprise/legacy/rejection paths also need deterministic tests.
- Revert commits for recovery; back up settings before migration. Old readers
  must ignore additive metadata safely. Do not downgrade while new-scope jobs
  are active; pause/finish them first and verify compatibility before rollback.

Implementation is accepted when these journeys pass with evidence and honest
coverage. Each remaining limitation is recorded; no single trial establishes
that every generated application is reliable.
