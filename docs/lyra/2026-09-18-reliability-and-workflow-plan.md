# Lyra project workflow: implementation plan

> Superseded by [revision 2](2026-09-18-reliability-and-workflow-plan-v2.md).
> Retained as planning history, not the active implementation specification.
> Revision 2 corrects the evidence interpretation and defines selectable QA scopes.

**Status:** superseded; no product code changed by this plan.
**Evidence:** [end-to-end comparison](2026-09-18-end-to-end-comparison-report.md)
and [trial log](END_TO_END_ACCEPTANCE.md).
**Goal:** preserve the current Studio UI and recoverable Hermes jobs while
making the user's selected delivery size control the actual work, giving prompt
progress feedback, and correcting the verified accounting/evidence defects.

## Decisions fixed by the user

- The New Project UI owns the choice of MVP/Fast, Balanced, Enterprise, or a
  custom agent team. Lyra may explain a risk or propose a change, but never
  silently adds agents or enlarges the project.
- Requirements still runs. Without permission to choose defaults, it asks one
  focused question at a time and obtains approval. With that permission, it may
  resolve remaining minor questions and move to planning; it must tell the user
  promptly what it assumed and what it is doing.
- The user can chat with Lyra while background jobs run. A visible job state
  must distinguish a live process from useful progress.
- Retain the good current UI and Hermes recoverable jobs. The historical version
  is evidence for useful interaction and sizing choices, not a rollback target.
- “Bano” is a conversational shorthand only; this plan does not rename the
  product, packages, UI, files, or public strings.

## First establish a testable baseline

Before each implementation slice, record the current commit and dirty worktree;
leave generated projects and unrelated files alone. Run the existing focused
tests and one small UI journey on an isolated profile. Record these milestones:
first visible acknowledgement, requirements approval, preview approval, queue
acceptance, worker start, first useful worker result, QA end, final message.
Capture provider input/output and cache counts, but do not store prompt content
or credentials in the change record. Use the same local model and a short
fixed brief for before/after comparisons. This gives each change a regression
signal without claiming one successful app proves general reliability.

## Implementation order and change boundaries

Each numbered item is one reviewable code change with a small change record,
focused tests, local commit, and its own release/push only when authorized.
Follow `CHANGE_MANAGEMENT.md` for versioning and CI. Do not edit product code
in the middle of a live user project; validate in isolated profiles, then
restart/retest the release candidate at a safe point.

Use one responsibility per new module or class, keep new files below 400 lines,
and extract a narrow helper instead of growing `ChatPage.tsx` or
`project_runs.py`. Reuse current Hermes storage, dispatch, event and skill
interfaces. Before each separate push, review the diff's effects on adjacent
paths, run its relevant integration checks, and make the required single patch
version bump with matching release metadata. A later failure should be
revertible to that change alone.

### 1. Carry the launcher decision into authoritative project state

**Observed seam.** The builder launcher already renders Personal, Reusable and
Production build sizes and agent checkboxes in
`plugins/ultimate-builder/dashboard/app/index.js`. It puts `build_profile`
and enabled agents in its URL setup seed. `web/src/pages/ChatPage.tsx` reads
the enabled agent IDs, but `web/src/lib/guided-project-setup.ts` reconstructs a
new seed that says no build size was selected. Later prompts can therefore ask
for scale again or rely on a missing profile. There is no evidence that the
selected profile is persisted as execution authority.

**Change.** Reuse the existing launcher choice; present clear MVP/Fast,
Balanced, Enterprise and Custom choices there. Define one small, validated
project setup record containing schema version, selected profile, approved
agent IDs, model/provider overrides, and revision. Store it through the
existing project registration/config boundary and read it on chat open and
resume. Pass it to the coordinator as current-turn context; do not rewrite old
conversation messages or its cached system prompt. A custom team is a team
selection, not permission for Lyra to infer a larger build size. Keep
Requirements available as the one required capability under the current
contract; every other agent is optional. Make the chosen mode/team visible in
the project UI.

**Effects to check.** Launcher seed, Studio chat setup, agent picker, saved
project resume, project move/trash, model routing, and non-browser project-run
CLI all need the same current record. Reject malformed/unknown agent IDs and
preserve the previous record on a failed save. Existing projects with no record
must keep their current in-flight jobs; show “delivery mode not set” and ask
before creating *new* automatic phases. Do not silently migrate or cancel jobs.
Project path validation must prevent one project from reading another's setup.

**Proof.** Real launcher → register → Studio → reload/reconnect journey with
MVP, Balanced, Enterprise, Custom, legacy project and malformed record. Assert
the profile/agent IDs seen by the backend match the UI choice; test model
override clearing and move/reopen behavior.

### 2. Enforce the selected agents and profile at the dispatch boundary

**Observed seam.** The front-end prompt says to use approved agents, but the
queue handler in `plugins/ultimate-builder/project_runs.py` checks phase IDs,
model routing and worker role, not the project's selected agent set. A model
instruction alone is not an execution boundary. The existing handler is shared
by CLI and tool callers, so a single guard there covers both.

**Change.** On every queue/retry that creates new work, validate the requested
phase against the current saved project selection and profile. Return a clear
request for approval when an agent is missing or would expand the profile. A
user-approved team edit advances the setup revision and permits later jobs.
Status, pause and stop remain usable regardless of the team; safety recovery
must not be blocked by a profile change. Reuse current role gates and Kanban
dependency/idempotency keys rather than creating a second scheduler.

**Effects to check.** Reused jobs and retries, old project jobs, phase aliases,
explicit model/provider routing, worker subprocesses, and direct CLI calls.
Never rewrite a running worker's identity or cancel it because someone edited
the team. A removed agent cannot be queued for new work; the UI must show how
already queued work is handled and require a deliberate pause/stop if desired.

**Proof.** Real project config + SQLite queue tests for allowed/blocked phases,
CLI and tool calls, retry/reuse, stale revision, concurrent team edit, worker
role denial, and project isolation. The blocked path must create zero tasks.

### 3. Make each delivery size change the work actually scheduled

**Observed seam.** `project_work_units.load_qa_work_units()` always creates
four dependent QA jobs, and `project_runs._work_plan()` does not pass it a
profile. The current Personal playbook promises smoke QA, so label and behavior
disagree.

**Change.** Make the work-unit policy an explicit function of the validated
project profile. MVP/Fast uses one bounded QA job that runs the actual project
tests and one core user journey, reporting failures honestly. Balanced runs
focused review and user-flow QA. Enterprise may use the present staged QA where
the approved scope warrants it. Custom queues only chosen roles; if QA is
chosen, the UI should let the user see its expected depth before work starts.
Keep the requirements approval and UI preview checkpoints in every applicable
mode. Document exact default agent mappings in one shared policy source so UI
labels and backend phases cannot drift.

**Effects to check.** Existing four-stage QA tasks retain their identities and
dependency chain; a profile edit must not duplicate them or convert a partially
finished run. The new MVP QA identity must be versioned/idempotent. QA evidence
schema, status/progress ledger, notification text, token roll-up and final
completion gate must understand either shape. Do not weaken the meaning of
“finished”: real tests and a real journey are still required.

**Proof.** Table tests for every profile and Custom combination, including
missing QA, retry after partial completion, legacy four-stage resume, exact
job count/dependencies, and final verdict. Run one end-to-end MVP and one
Balanced journey in isolated projects; compare active time and result quality.

### 4. Acknowledge long foreground work and keep chat usable

**Observed seam.** In the Pocket Tasks run, the first model call finished in
26 seconds; plan/preview approval appeared after about six minutes. Since the
user permitted simple defaults, the planning itself was appropriate. The
missing piece was an early, truthful user-facing update. The first Kanban call
came after approval and did not cause this initial silence.

**Change.** Use the existing TUI/gateway event and Studio status surfaces to
show immediate receipt of the brief, then a model-authored concise update once
Lyra decides which defaults it is taking. It should name the next phase and
give a conservative expectation (“I am preparing the plan and preview; this
may take several minutes”), then continue working. A generic transport status
must not claim the model made a decision before it has. On a real queue
acceptance, announce the owner and finish the foreground turn so chat is free.
Show elapsed time/last useful activity during prolonged planning; status
updates must never masquerade as completed chat replies.

**Effects to check.** Strict user/assistant message alternation, saved
transcript, PTY event replay, reconnect, pending questions, cancellation,
notifications, accessibility and plain-language display. Do not inject a
synthetic user turn or mutate historical prompts, which would break caching.
If the provider does not stream, the UI can still show a neutral “Working on
your brief” indicator immediately; it cannot invent assumptions for Lyra.

**Proof.** Real gateway/Ink/Studio journey for normal interview, explicit
defaults, slow provider, approval, disconnect/reconnect, and parallel worker.
Assert the first neutral update appears promptly, the assumptions message
appears once, and a later answer is neither lost nor duplicated. Measure
time-to-first-visible-update separately from time-to-plan.

### 5. Correct provider-facing context estimates

**Observed seam.** `agent/turn_context.py` estimates stored messages before
`agent/conversation_loop.py` constructs provider-facing messages. In this
custom-provider trial, stored `reasoning` and `reasoning_content` inflated the
rough estimate and triggered policy compression earlier than actual request
size required. The observed reconstruction was roughly 156k stored-message
tokens versus 35k after the provider's outgoing transformation (excluding
system, tools and other sidecars).

**Change.** Reuse the same provider-specific outgoing-message normalization for
preflight estimation, or extract a pure shared projection used by both paths.
Preserve reasoning echo for providers that require it. Count actual tool schema,
system prompt and image sidecars; do not lower the context safety ceiling based
only on this one GLM run. Keep compression as the allowed cached-prefix reset.

**Effects to check.** Provider switch/fallback, DeepSeek/Kimi/MiMo echo rules,
strict OpenAI-compatible providers, failed compression recovery, model window
limits and cache accounting. Stored history remains intact and must not leak
cross-provider reasoning content.

**Proof.** Tests compare estimator input with the outgoing message projection
for custom GLM and echo-required providers; exercise a real session across
turns/compression with a temporary profile. Measure compression frequency,
first-token latency and cache hit rate before and after.

### 6. Make verification evidence reflect the tested command

**Observed seam.** `agent/verification_evidence.py` classifies a recognized
test command as passed when the terminal's exit code is zero. For
`npm test 2>&1 | tail -50`, that can be the `tail` status while tests failed.

**Change.** Record passed evidence only when the actual verification command's
status is known. Prefer direct commands and bounded tool output. For a shell
pipeline whose exit status can mask an earlier test, mark evidence
“unverified” unless pipefail or an equivalent status capture is proven. Keep
the original command/output in the audit trail; do not reinterpret old rows as
passed. Worker playbooks should request direct test commands.

**Effects to check.** POSIX shell versus PowerShell, redirection, `tee`, `head`,
legitimate pipelines, background commands, and the completion gate consuming
evidence. Do not block ordinary terminal commands; only their claim as passed
verification changes.

**Proof.** Real terminal invocations of a failing test piped to `tail` and a
passing test direct/with supported status propagation. Assert false success is
impossible and the final QA gate reports unverified rather than passed.

### 7. Make usage and progress labels truthful

**Observed seam.** Coordinator and worker usage arrive through different paths;
some Studio states showed “Not reported yet” after showing a total. Job
heartbeats say the process is live, not that the model or files progressed.

**Change.** Define one display policy for coordinator usage, worker reported
usage, missing data and freshness. Keep totals distinct unless both sources
have non-overlapping session IDs; show “not reported” for missing usage. Use
the existing job activity timestamps plus model/tool events for “last useful
activity,” and label process liveness separately. Do not add another polling
authority or telemetry backend.

**Effects to check.** Retry attempts, late usage snapshots, reconnect replay,
stale jobs, completed jobs, zero-token turns, and totals after a provider/model
switch. Avoid double counting retry snapshots or overwriting a known total
with an unknown value.

**Proof.** Pure roll-up tests and captured gateway-frame replay, followed by a
browser journey with an active worker, idle worker, retry and reconnect. The
UI must never show zero when the value is unknown.

## Integration and release gate

After the slices, run the repository's focused Python, web, Ink and plugin
tests, typecheck/lint, generated-asset checks, and the real Studio browser
smoke. Use a clean release candidate and run two full small projects: one MVP
with an explicit defaults request, one Balanced with an actual requirements
interview. Verify approvals, saved profile/team, no unapproved jobs, background
chat responsiveness, browser recovery, exact test evidence, final app behavior
and final user message. Deliberately interrupt/restart one worker and reopen
one conversation. Compare the baseline milestones and token/cache/compression
numbers; record regressions as well as improvements.

Success means these specific journeys and gates pass, with no hidden team
expansion or misleading progress. It does not mean every possible generated
application is guaranteed reliable. Keep each slice separately reversible via
its commit. Preserve existing project data, take backups before any migration,
and do not restart an active user job for rollout.
