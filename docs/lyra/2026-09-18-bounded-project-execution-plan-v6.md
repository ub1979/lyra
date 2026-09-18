# Lyra bounded project execution plan — revision 6

Date: 2026-09-18. Status: slices 1, 2, 3, 4a and 4b implemented as local
commits (not pushed); live acceptance (Slice 5) not yet run. Supersedes
revision 5 as the active plan.
[Revision 5](2026-09-18-bounded-project-execution-plan-v5.md) remains a
reference. Evidence: the Trial 3 worker trace and run records in the
[trial log](END_TO_END_ACCEPTANCE.md), plus the source checks named below.

No product code is changed by this document. Each implementation slice needs
its own change record, behavioral tests, local commit, patch release metadata
and separately authorized push.

## What changed from revision 5

1. **60 calls is a Personal performance target, not a stop.** Personal keeps
   the current 90-call safety limit during the next trials. Nothing has yet
   shown the lean procedure can finish within 60; a lower stop risks another
   premature failure.
2. **Budgets must cover a whole worker attempt.** `agent/turn_context.py`
   creates a fresh `IterationBudget(agent.max_iterations)` at every turn start.
   Goal-mode workers receive judge continuation prompts in the same session,
   up to `DEVELOPMENT_GOAL_MAX_TURNS = 12` (other phases 8). A per-turn
   `--max-turns` value therefore does not bound an attempt. Revision 5's
   "180 maximum" would have been misleading.
3. **Runner health has three states.** The existing presence probe
   (`hermes_cli/kanban.py`, `_check_dispatcher_presence`) returns healthy when
   its own probe fails, and a live gateway does not prove the machine-wide
   dispatcher lock is held or that ticks are happening.
4. **The test contract is repeatable and applies to every profile.** Revision
   5's prescribed "zero-install test page run once" is removed.
5. **Preview approval is backend-owned and enforced inside
   `queue_project_run`.** Tool and CLI paths share the check. Existing
   projects and post-approval edits have defined behavior.
6. **Exhaustion keeps the existing runtime-owned path.** Source and the Trial 3
   run record show the runtime already records exhaustion itself (see Slice 4).
   No model-callable block reason is added.
7. **Slice 4 is split.** Only the exhaustion visibility and retry policy are
   needed before the Personal trials. Attempt-wide budgets and per-profile
   ceilings are needed before the Production journey.

## Decisions carried forward

- Keep **one** well-instructed Development worker for a Personal project. A
  task map returns only if measured Personal journeys cannot finish under the
  90-call safety limit, or finish but consistently exceed the 60-call target.
- Keep the long-lived **gateway** as the only Kanban dispatcher. Repair its
  macOS supervision and start path; do not add a dashboard scheduler.
- Preview approval is an authorization boundary owned by the backend, not an
  instruction the model interprets from its own prose.
- Do not raise global `agent.max_turns`; it affects ordinary chats and
  unrelated workers.

## Order

| Order | Slice | Needed before |
|---|---|---|
| 1 | Preview authorization | Personal trials |
| 2 | Job runner health and start | Personal trials |
| 3 | Worker ledger and test contract | Personal trials |
| 4a | Exhaustion visibility and retry policy | Personal trials |
| 5a | Two Personal journeys | Production journey |
| 4b | Attempt-wide budgets and profile ceilings | Production journey |
| 5b | One Production graph journey | Release sign-off |

## Slice 1 — backend-owned preview authorization

### Outcome

For a UI project, the first Development job cannot be queued until the user
has explicitly approved or skipped the *current* preview. Requirements approval
and "use smart defaults" never count as preview approval. The coordinator
cannot create an approval by writing files, ledger lines, markers or prose.

### Design

- **Backend owns the checkpoint.** When the coordinator presents a preview, the
  backend creates one pending preview checkpoint through the existing
  gateway-owned clarification/request-ID channel (`tools/clarify_gateway.py`).
  It stores workspace identity, session identity and a digest of the canonical
  preview location, `.sdlc/preview/`, which the app-it playbook already names.
  Previews written elsewhere (Trial 2 used a requirements prototype) must be
  moved or linked there before the checkpoint is created; the playbook states
  this. The UI only presents the checkpoint and its `Approve`, `Change` and
  `Skip` choices.
- **Typed answers.** A clear typed approve/skip in the normal composer resolves
  the pending checkpoint through the existing text-response binding
  (`resolve_text_response_for_session`). It is accepted only when it is a
  genuine user message, for this session and workspace, received after the
  checkpoint's preview digest was recorded. Assistant text, internal setup
  messages and replayed frames never qualify.
- **One shared check.** `queue_project_run` validates the checkpoint before
  creating any task, so the `project_run` tool, the CLI and retries share it.
  Missing, stale, rejected, wrong-session, wrong-workspace or digest-mismatched
  approval fails closed with a plain message telling the coordinator to present
  the preview.
- **Consumption and later edits.** The approved digest is written into the
  Development task's existing event/instruction data when it is queued. Editing
  the preview afterwards invalidates only an approval that has not yet been
  used; it does not stop an already queued or running Development job.
- **Scope of the gate.** The gate applies to the first Development queue of a
  UI project only. Non-UI projects (API, CLI, library) receive a
  backend-recorded automatic skip, matching the playbook's existing auto-skip.
  Repair jobs, resumes, retries, QA and other later phases are not gated.
- **Existing projects.** Projects whose Development is already queued, running
  or done are exempt. A project still at the preview stage gets a checkpoint
  the next time the preview is presented.

### Tests

- Button approve, typed approve and typed skip after the digest each permit
  queueing; `Change` does not.
- Refused: a user message older than the digest, assistant prose, a
  model-written file or ledger line, wrong session or workspace, and a preview
  changed after approval but before queueing.
- Tool and CLI callers get the same refusal. The Trial 3 turn, replayed as a
  frame fixture, is refused.
- Non-UI auto-skip, repair/retry/QA exemptions and legacy-project exemptions.
- Reconnect restores exactly one pending checkpoint and cannot replay an old
  answer into a new preview.

## Slice 2 — job runner health and user-triggered start

### Outcome

A normal Studio project's ready job starts automatically. When it cannot,
Studio and the coordinator say so truthfully and offer a working action.

### Design

- **Three health states.** `running` means a live process holds the
  machine-wide `.dispatcher.lock` and has recorded a dispatcher tick within the
  configured interval plus a margin. The holder need not be this profile's
  gateway, because the lock deliberately allows one dispatcher per machine.
  `unavailable` means no gateway, dispatch disabled, or no lock holder.
  `unknown` means the probe itself failed; it is never shown as healthy.
- **Tick evidence.** No tick record exists today. Add a small, atomically
  written last-tick timestamp from the existing gateway dispatcher loop. This
  is evidence only; it adds no scheduling.
- **Coordinator truth.** `project_run` queue, status and resume include the
  same health state. The coordinator may not tell the user a job will start
  shortly when health is `unavailable` or `unknown`. Trial 3's "no dispatch
  problems" and "nudged the scheduler" replies are the regression cases.
- **Start action.** When health is not `running`, Studio offers a
  user-initiated **Start job runner**. On macOS it uses the existing
  `hermes gateway start`/LaunchAgent path to install or repair the per-user
  LaunchAgent, then verifies `launchctl` supervision, a live PID, lock
  ownership and a fresh tick. It never starts a second in-dashboard
  dispatcher. Without launchd, it reports the detached fallback's limitation
  and does not claim crash recovery.
- **Proof of pickup.** After a start, success is shown only when a ready task
  is actually claimed (or, with no ready task, a fresh tick is recorded).
- **Root cause.** Trial 2's gateway exited on an unexpected signal expecting a
  systemd restart. Record why no LaunchAgent existed on this machine and fix
  that installation path.

### Tests

- Probe failure reports `unknown`, never `running`.
- Live gateway without the lock, lock without ticks, and lock with fresh ticks
  map to the correct states.
- macOS lifecycle fixtures: no plist, stopped runner, unexpected exit under
  launchd, repeated start. Exactly one gateway and one dispatcher result.
- Dashboard-only fixture: health `unavailable`, action starts the managed
  runner, a ready task is claimed without manual `kanban dispatch`.
- Coordinator status replies with health `unavailable` never promise a start.

## Slice 3 — worker ledger and repeatable test contract (all profiles)

### Outcome

Workers receive the information and test path they need before they begin.
No worker searches Lyra's source or another project to learn a format.

### Design

1. **Ledger template.** The Development task body (and every other phase body
   that asks for ledger updates) includes the exact supported
   `.sdlc/progress.md` format with one short example. Preparing the project
   repository also creates the ledger from that template when it is missing.
2. **One repeatable test command.** Requirements or the preview handoff names
   the project's primary test command. It uses a test runner suited to the
   project with a reliable exit status. When a dependency-free project has no
   runner, the default is Node's built-in test runner for logic modules; it
   needs no installed packages. Workers rerun the command after every repair,
   and its result is recorded through the existing masked-failure-safe
   evidence path. Browser tooling is for real user journeys, console checks and
   responsive checks, and is repeated whenever a defect or repair warrants it.
   It is not the loop for individual unit assertions.
3. **Personal procedure.** The selected profile is passed into the Development
   task body. Personal keeps module boundaries, validation, Git commits and
   real verification, but omits production-only design and release ceremony.
   Whether this explains Trial 3's browser-only test choice is an inference to
   validate in Slice 5a.

Reusable and Production keep their current procedure, gaining only the ledger
template and test contract.

### Tests

- Every phase body that requests ledger updates contains the template; a fresh
  repository gets a template ledger.
- A real temporary static-app worker fixture makes zero ledger-discovery
  searches outside the project and records test results through the terminal
  command, including a rerun after a deliberate repair.
- A deliberately failing test recorded through a pipeline is never classified
  as passed.
- Existing skill loading, Git boundary, evidence and browser-unavailable
  fallback remain covered.

## Slice 4a — exhaustion visibility and retry policy (before Personal trials)

### Evidence

The runtime already owns exhaustion. `agent/turn_finalizer.py` calls
`_record_task_failure(outcome="timed_out")` with
`run_summary=exhaustion_handoff(final_response)`. Trial 3's run record holds a
2,727-character handoff marked "unverified handoff, NOT completion". The task
has `max_retries = 2`: the first exhaustion returns it to `ready`, and the
retry receives that handoff in its worker context
(`tests/hermes_cli/test_kanban_budget_handoff.py`). A second failure trips the
existing breaker to `blocked`. The worker's own `kanban_block` call was
rejected by the goal-mode rule, which is harmless because the runtime path ran.

The real gaps are:

- `_iteration_exhausted()` in `project_runs.py` only recognises `blocked`, so
  Studio and the coordinator show an exhausted task as a healthy `ready` task.
- The retry uses the same broad task body and the same budget, so an
  unchanged approach can spend a second full budget.

### Design

- Do **not** add a model-callable block reason. The goal-mode restriction stays
  as it is.
- Recognise exhaustion from the runtime's own run record (`timed_out` outcome
  with the exhaustion error) in any task state, and show it in Studio and
  `project_run` status as "stopped at its call limit; continuing from handoff"
  or "stopped at its call limit; needs a decision".
- Keep the existing failure accounting and breaker unchanged.
- **Retry policy (decision below).** Enforce it at the database/dispatcher
  boundary, not in the display check.

### Decision required before implementation (resolved: A)

The earlier review proposed preventing automatic retry after exhaustion. The
run record shows the retry is not blind: it carries the saved handoff. Choose
one before implementing:

- **A — Recommended for the Personal trials:** allow the existing single
  automatic continuation. It must carry the handoff, and its task context must
  name the unfinished acceptance items from that handoff. A second exhaustion
  blocks through the existing breaker. This keeps Trial 3's near-finished
  state recoverable without a manual step, and the trial measures it.
- **B:** an exhausted project task moves directly to `blocked` with a "needs a
  decision" reason. The dispatcher never reclaims it automatically; the
  coordinator or user starts an explicit continuation that names the remaining
  work.

### Tests

- Exhaustion appears as call-limit stopped, never as healthy `ready`.
- The chosen policy is enforced at the database boundary: under A, exactly one
  automatic continuation carrying the handoff; under B, no dispatcher reclaim.
- The goal-mode block restriction is unchanged, and failure counts and the
  breaker behave as before.
- A late duplicate finalization does not spend another retry.

## Slice 4b — attempt-wide budgets and profile ceilings (before Production)

### Design

- Store an attempt budget on the task. The worker process counts model calls
  across the first turn and every goal-loop continuation of one attempt. Each
  new turn receives only the remaining budget, not a fresh
  `IterationBudget(agent.max_iterations)`.
- Report judge and exhaustion-summary calls separately; they do not consume the
  worker's tool-calling budget but are shown in usage.
- Ceilings, per attempt:

| Profile | Attempt ceiling | Rule |
|---|---:|---|
| Personal | 90 calls (target under 60) | One whole-app worker while the lean procedure is measured |
| Reusable | 90 calls | One planner-defined feature or work item |
| Production | 180 calls | One planner-defined complex work item, never the whole application |

- **No task graph.** Reusable and Production Development must not fall back to
  one whole-application task. When no valid graph exists, `queue_project_run`
  refuses Development with a plain message asking for task planning first.
  Personal is exempt because its single worker is the chosen design.
- Legacy tasks keep current behavior.

### Tests

- The budget spans turns: a worker cannot exceed its attempt ceiling through
  goal continuations.
- Judge and summary calls are reported separately.
- Ceilings reach the real worker command; legacy tasks are unchanged.
- Reusable/Production Development without a graph is refused; Personal is not.

## Slice 5 — live acceptance

### 5a — two clean Personal Todo journeys (after slices 1–4a)

Run through a gateway-backed Studio with one coordinator per project. Verify
the generated application directly against the unchanged Pocket Tasks
acceptance criteria, not from Lyra's report.

| Check | Required result |
|---|---|
| Preview → Development | No queue before explicit user approval or skip |
| Ready task pickup | 0 manual dispatcher commands |
| Runner health | Correct state shown; start action proven if the runner was down |
| First real project source file | Within 3 minutes of worker claim |
| Development calls | Target under 60; must finish under the 90-call safety limit |
| Ledger discovery | 0 searches outside the project |
| Test evidence | Terminal command result recorded, rerun after repairs |
| Deliberately failing test | Never recorded as passed |
| Browser verification | Real user journey, not a per-assertion loop |
| Reconnect | No lost replies and no duplicate work |
| Usage | Coordinator and worker totals separate; unknown shown as unknown |
| Completion | Local commit, direct acceptance checks and truthful QA verdict |

Record session and task IDs, and keep separate clocks for provider time,
active work time and user waiting time.

### 5b — one Production graph journey (after 4b)

Prove that a valid graph creates bounded items, that a complex item may use up
to its 180-call attempt ceiling across continuations without exceeding it, and
that no duplicate workers or approval bypasses occur. It need not spend 180
calls.

## Deferred — only return if Slice 5 proves it necessary

- A Personal task map or multi-card split.
- A dashboard scheduler, a settings/revision protocol, a broad kill redesign,
  automatic swarms and a QA redesign.
- Raising global `agent.max_turns`.
