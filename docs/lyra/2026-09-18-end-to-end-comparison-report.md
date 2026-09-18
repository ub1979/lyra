# Lyra end-to-end comparison report

**Date:** 2026-09-18
**Purpose:** Compare the current Lyra project workflow with a historical
pre-recoverable-project-agent version, identify why the historical version felt
faster, and preserve the evidence for a user-led product plan.  This is an
analysis report. It makes no product-code change or release claim.

**Active proposed plan:** [reliability and workflow — revision 3](2026-09-18-reliability-and-workflow-plan-v3.md),
including independently selectable Functional QA and Experience QA.

## Reviewed conclusions

The historical workflow reached its first question sooner than the current
workflow reached combined plan/preview approval. These are different milestones.
The current assistant did generate interim progress messages; Studio does not
handle the gateway's `message.interim` event, and buffers `message.delta` in a
ref instead of presenting those updates. A real frame-replay test should confirm
the display path before implementation. **Kanban dispatch did not account for
the initial wait**: `project_run` was first used after preview approval.

The current workflow produced more recorded verification evidence and has
durable/recoverable background jobs. The historical workspace was marked
delivered, but two coordinator sessions launched overlapping workers in it.
Its later timings and final output cannot establish single-run performance or
relative quality. Preserve current recovery, make user-selected profiles govern
the work, and display the assistant's existing progress messages promptly.

## Scope and fairness limits

- Both trials used the same configured local custom provider/model:
  `glm-5.3-flash:cloud` at `http://127.0.0.1:11434/v1`.
- Both used the same small Pocket Tasks brief: local browser task list,
  localStorage persistence, filters, keyboard-friendly controls and tests.
- Historical source was `b196c0397` (2026-07-29), before recoverable project
  agents landed on 2026-08-29. It ran in a separate `/private/tmp` profile and
  project directory.
- The historical checkout reused the current Python virtual environment. It is
  a useful behavioral comparison, not a perfect period machine image.
- Provider work from both trials may overlap, so wall-clock provider latency is
  not a controlled benchmark. The comparison relies on logged calls, tool
  ordering, artefacts, and visible user-flow events.
- The historical database records two root conversations for the same workspace:
  `20260918_085048_597cdf` and `20260918_123533_c64707`. The latter began at
  12:35:48 with `approve`; both then launched delegates. This followed manual
  reconnection/approval recovery. The cause of the duplicate conversation has
  not been established. Later outputs may reflect overlapping work; exclude
  them from single-run speed and quality claims. Early requirements timings
  predate this overlap, but compare different user-facing milestones.

## Outcome of each trial

| Topic | Current Lyra | Historical Lyra |
|---|---|---|
| Project result | Pocket Tasks finished | Shared historical workspace marked delivered after overlapping runs |
| Development evidence | Committed project work | Functional vanilla JS app |
| Automated tests | 108 tests passed in final QA | 68/68 `node --test` reported |
| Browser/user journeys | 60/60 final browser journeys passed | Browser verification reported; QA marked 0 bugs |
| Initial visible interaction | Plan/preview approval shown after ~6m02 active work | First optional scope question after ~1m20 active work |
| Start of implementation after approval | ~36 seconds to dispatch current project job | ~44 seconds to create historical development delegate |
| Execution model | Durable, recoverable project jobs through `project_run`/Kanban | Browser-owned delegated workers |
| Delivery reliability observed | Completed this one trial, but not universal proof | Later result confounded by overlapping sessions and broken guided controls |

The final apps and test suites do not support a relative quality score. Counts
describe recorded evidence, not coverage equivalence. Current Lyra completed
this trial; the historical workspace's delivered state is not proof of a clean
single-coordinator run.

## What made the historical version feel faster

### First visible response

Historical Lyra made one first call (78.6 seconds; 23,611 input and 7,544 output
tokens), then immediately asked the optional-scope question.

Current Lyra's first model call took 26.4 seconds with 21,453 input tokens.
Before the combined approval prompt it:

1. loaded the 21,209-character Requirements (`req-engineer`) tool result and searched the workspace;
2. made a 141.9-second response with 15,069 output tokens;
3. made a 152.9-second response with 18,038 output tokens;
4. created plan/preview artefacts and inspected the preview in a browser;
5. made further model/tool steps before presenting approval after call 8.

Saved public assistant content already included “Requirements work is starting
now” and an explanation that defaults would be used. The gateway emits
`message.interim` in `tui_gateway/server.py`; Ink and Desktop handle it. Studio's
`web/src/lib/guided-event-reducer.ts` has no corresponding handler. Therefore
the next fix should first expose existing messages, rather than assume the
assistant never attempted to report progress.

The current initial input was smaller than historical input. Raw prompt size
alone does not explain the difference. The six-minute interval included
planning/preview work and a display gap; it is not evidence that all six minutes
were wasted or that the same task ran more slowly.

### Important correction: this was not necessarily wasted work

The Pocket Tasks brief told Lyra to choose simple defaults. Lyra interpreted
that as permission to decide the remaining minor requirements rather than ask
redundant questions. The user confirmed that this is desired behavior: when
they grant defaults, Lyra should progress into planning rather than force an
interview.

So the defect is **communication**, not Requirements or Kanban:

> As soon as Lyra chooses defaults, it should visibly say that it has enough
> information, list the important defaults briefly, say it is preparing the
> plan/preview, and set an honest expectation for the next update.

If the user has not granted defaults, Requirements should continue to ask one
focused question at a time and obtain approval before planning.

## Kanban finding

The first current `project_run` call occurred at 05:26:00, after preview
approval. It cannot explain the earlier ~6-minute wait.

Kanban remains relevant to later execution:

- it gives current Lyra persisted, recoverable work and project-local commits;
- it makes job state, notification, liveness and cancellation more complex;
- it should be measured separately for dispatch delay, worker completion,
  recovery and QA cost.

Do not use the initial-response evidence to remove Kanban. It does support
making the foreground conversation finish and report quickly once a job is
accepted.

## Historical workflow: useful ideas and warnings

### Preserve

- The old New Project flow exposed an **MVP fast path**.
- It asked/updated the user earlier in the flow.
- After a received approval, it reached development quickly.
- It used a smaller apparent team for this simple project.

### Do not copy unchanged

- Historical guided UI hid clarification and approval controls. Some waits were
  UI/input wait, not model latency.
- Development hit `max_iterations_reached(50/50)`.
- Multiple QA continuations also hit the same cap, then restarted.
- Later calls using the same session IDs came from Hermes `bg-review` threads,
  which perform normal learning after worker turns. Missing QA-skill lookups
  and successful edits of local learned skills occurred there. Logs show
  bundled-skill edit attempts were rejected. These events do not establish that
  a QA worker rewrote its governing playbook during testing. Preserve Hermes
  learning and the existing protection of bundled/user-owned instructions.

These are reasons to retain strict worker boundaries, durable state, and
explicit UI controls in the current product.

## Current workflow: confirmed strengths

- The current trial completed a full, independently checked Pocket Tasks app.
- Jobs use durable project state rather than only a browser-owned worker.
- Project changes are committed locally and work can be recovered after a
  browser disconnect.
- The current UI and project view are much more capable than the historical
  guided UI.
- The Requirements playbook already supports both a focused personal path and
  a thorough interview for users who have not granted defaults.

## Current workflow: confirmed design mismatches or open defects

### 1. The existing launcher choice does not survive the Studio setup path

The current builder launcher already offers Personal, Reusable and Production
profiles, plus starting templates and customizable agent checkboxes. The Studio
chat reads the selected agents from the launcher seed, but rebuilds its own
`guidedSetupSeed` without the selected `build_profile`; that reconstructed seed
actually says no build scale was selected. The profile is present in the older
launcher payload but is not carried through as durable execution authority.
The requested change is to make the existing UI choice authoritative and
persistent, with clear MVP/Fast, Balanced, Enterprise and Custom presentation.
Lyra should not silently expand the chosen team.

### 2. Personal/MVP policy is not enforced by actual QA scheduling

Current `load_qa_work_units()` always returns four serial QA stages (QA-001 to
QA-004) and receives no project-profile input. This contradicts the App-IT
instruction that Personal normally uses a smoke QA only. It explains why the
tiny personal trial received an enterprise-like QA sequence.

### 3. Studio does not present existing interim assistant updates

Restore display of the gateway's interim messages and ensure the final reply
does not erase or duplicate them. An interim message must not complete the
turn, trigger another phase, or count as an approval. Keep a truthful receiving/
working status while a provider has not yet produced text. Measure both receipt
feedback and actual model-message delivery; do not promise an invented ETA.

### 4. Coordinator-context accounting needs correction

Before its first compression, the coordinator's local estimator counted stored
reasoning fields that are removed or transformed for this custom provider's
actual API request. This caused a premature policy compression estimate. The
safe fix must estimate the provider-facing message shape without deleting
history that other providers require.

### 5. Test-evidence handling must reject masked command failures

One worker reported a test command through `... | tail`, where the shell
pipeline's exit code could be zero even if the actual test command failed.
Later direct tests passed, so the app result was not invalidated, but evidence
collection must reject or correctly interpret piped test commands.

### 6. Usage/status visibility remains separate from worker correctness

Earlier observations found coordinator-only token display and stale/unknown
worker accounting. A progress panel should distinguish “working,” “last useful
activity,” and “usage not yet reported”; it must not imply that a live process
has made useful progress merely because a heartbeat exists.

## Product decisions supported by evidence

These are product decisions for the user to assess, not implemented changes.

1. **The product UI owns project setup.** Its New Project UI chooses delivery profile,
   agents, and optional model assignment before Lyra starts work.
2. **Lyra owns the conversation.** It interviews when needed, explains its
   assumptions when defaults are allowed, and reports progress in plain
   language. It does not silently change the user's selected team.
3. **Requirements depth and delivery scale are different knobs.** A user may
   want a thorough interview but a small MVP build, or defaults plus a balanced
   build. Do not conflate them.
4. **Profile selection changes execution, not just labels.** An MVP must queue
   only the agreed minimal phases and selected, proportionate QA scopes. Custom executes
   only the selected agents. Any proposed additional safety work requires a
   clear explanation and user approval.
5. **Keep durable jobs behind the UI.** They solve real recovery problems. Make
   them invisible as machinery: Lyra should promptly say what is happening,
   what remains, and whether the whole app is finished.

## Suggested acceptance checks for a later implementation plan

- A New Project screen permits MVP, Balanced, Enterprise and Custom selection
  without a model conversation.
- The chosen profile and agents are visible, persisted, editable before work,
  and are the only automatic execution authority.
- A new MVP project produces no architecture, security, deployment or
  multi-stage QA job unless the user selected or approved it.
- QA has two selectable scopes: Functional QA and Experience QA. Either or both
  can run; reports distinguish selected coverage from checks not selected.
- A user message that grants defaults produces a visible acknowledgement before
  any slow planning/preview work starts.
- A user who has not granted defaults receives the normal one-question-at-a-time
  requirements flow.
- A project job may recover after a browser disconnect; a worker cannot spawn
  an unbounded worker tree. Preserve existing Hermes learning safeguards.
- Token/status UI shows unknown as unknown and treats progress separately from
  process liveness.
- Test evidence records the real test command's exit status.

## Supporting material

The detailed chronological log, source references, raw timing, and intervening
observations remain in:

- `docs/lyra/END_TO_END_ACCEPTANCE.md`

The historical comparison server was stopped after the old project reached its
delivered state. The current Lyra project and current Lyra processes were
not changed by this report.
