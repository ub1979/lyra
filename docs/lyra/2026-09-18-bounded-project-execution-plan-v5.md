# Lyra bounded project execution plan — revision 5

Date: 2026-09-18. Status: superseded by [revision 6](2026-09-18-bounded-project-execution-plan-v6.md);
kept as a reference. It superseded revision 4.
Basis: the real Trial 3 worker trace, which identified 46 browser test/console
operations, 22 code/test writes, 12 searches for a project-ledger format, and
about 10 other operations. The worker loaded two skills, read the preview once
and took no screenshots. Do not attribute its 90-call exhaustion to repeated
skill loading or preview self-review.

No product code is changed by this document. Each implementation slice needs
its own change record, tests, local commit, patch release metadata and separate
authorized push.

## Decisions made now

- Keep **one** well-instructed Development worker for a Personal project.
  Do not split a five-file app into several cards yet: each card repeats worker
  startup reads and would recreate the browser test loop.
- Keep the existing long-lived **gateway** as the only Kanban dispatcher. Fix
  its macOS supervision/start path; do not create a dashboard scheduler.
- Permit a Production/Enterprise work item up to **180 actual model calls**,
  but only after it has a valid, bounded task graph. No profile may queue one
  unlimited “build the whole application” card.
- Treat preview approval as an authorization boundary, not an instruction the
  model can infer from its own prose.

## Slice 1 — real preview authorization

### Outcome

Code cannot queue until the user has explicitly approved or skipped the
*current* preview. Requirements approval and “use smart defaults” do not count
as preview approval.

### Design

Reuse the existing gateway-owned typed clarification/request-ID answer channel.
When preview files are ready, the trusted UI creates one pending preview
checkpoint containing the workspace identity and a snapshot digest of the
preview files. Button selections (`Approve`, `Change`, `Skip`) resolve that
request ID only through the gateway.

The normal composer must also work: when a user types a clear approval/skip
answer while that same checkpoint is pending, the gateway binds the saved user
message to that request ID. It accepts it only if the user message arrived
after the preview snapshot was written. A new preview digest invalidates old
answers. The coordinator cannot manufacture either kind of approval by writing
a file, a ledger line, a marker, or assistant text.

`project_run` verifies the approved/skip checkpoint and current digest at the
Development queue boundary. Missing, changed, stale, rejected, wrong-session
or wrong-workspace approval fails closed with a plain message.

### Tests

- Button approval, typed-composer approval, and typed `skip` after preview
  snapshot each permit the intended action.
- A user message before the newest preview, assistant prose, a model-written
  ledger/file, wrong workspace/session, `Change`, and a changed preview all
  refuse queueing.
- Reconnect restores exactly one pending checkpoint and cannot replay an old
  answer into a new preview.

## Slice 2 — dependable job runner on macOS

### Outcome

A normal Studio project starts its ready worker automatically. If the runner is
down, Studio presents a useful action—not merely a warning.

### Design

Use the existing `hermes gateway start` / launchd service path, including its
existing singleton and dispatcher locks. In Studio, show job-runner health from
the existing dispatcher-presence probe. When unavailable, offer a
user-initiated **Start job runner** action that invokes the managed gateway
start path for this profile; it must not spawn a second in-dashboard dispatcher.

On macOS, starting this action repairs or installs the existing per-user
LaunchAgent and verifies `launchctl` supervision plus a live gateway PID. This
addresses the observed failure mode: the prior gateway exited expecting an
external/system service restart, but no LaunchAgent existed to restart it.
If launchd is unavailable, surface the existing detached fallback’s limitation
honestly; do not claim crash recovery.

### Tests

- macOS service lifecycle fixtures: no plist → start creates/loads it; stopped
  runner → start reaches a live gateway; unexpected gateway exit under launchd
  restarts one gateway; no duplicate process/dispatcher is created.
- Dashboard-only fixture reports unavailable runner and the action starts the
  managed runner; ready task is claimed without manual `kanban dispatch`.
- A live gateway picks up a new ready task within the configured wake/tick
  bound. No normal Studio journey requires a manual dispatcher command.

## Slice 3 — make one Personal worker efficient and self-sufficient

### Outcome

The worker receives the information and test path it needs before it begins. A
small project does not waste calls discovering Lyra’s internal ledger format or
driving every test case through browser navigation.

### Design

Pass the selected profile into the existing Development task body and add a
small Personal branch to the existing developer contract—no duplicate agent or
skill. It keeps clear module boundaries, validation, project Git commits and
real verification, but supplies these missing instructions:

1. **Ledger template:** the exact supported `.sdlc/progress.md` format and one
   short example are included in the worker body. The worker must not search
   Lyra or another project merely to discover the format.
2. **One terminal test command:** the requirements/preview handoff names a
   deterministic primary test command for the project. For a static browser
   app, the worker creates a zero-install test page that reports its result and
   runs it once through a supported terminal/browser harness. Browser use is
   reserved for one final real user journey, console check and responsive check;
   it is not the loop for every unit assertion.
3. **Personal procedure:** build the approved core path early, test the
   assigned behavior, save evidence/commit, then run one focused real-browser
   smoke. Do not load production-only design/release ceremony. This is a
   scoped instruction change; whether it alone explains all test choices is an
   inference to validate in the next run.

The unchanged Reusable/Production developer procedure remains intact.

### Tests

- Personal worker body contains the ledger template, one test-command contract
  and the scoped procedure; other profiles retain their current contract.
- A real temporary static-app worker fixture shows no source-tree ledger
  discovery calls, records one terminal test result, and uses browser tooling
  only for its final journey.
- Existing developer skill loading, Git boundary, required evidence, normal
  test failures and browser-unavailable fallback remain covered.

## Slice 4 — per-job actual-call budget and exhaustion recovery

### Outcome

The budget that stops a worker is visible, profile-appropriate and recoverable.
An exhausted worker keeps its factual handoff and is not silently returned to a
generic ready state.

### Design

Add one per-task `max_agent_iterations` value to the existing Kanban task
record. Pass it through the existing worker CLI `--max-turns` mechanism. This
controls the initial real agent loop, unlike the existing outer `goal_max_turns`.
It is not a new worker runtime or scheduler.

Initial ceilings apply only to a **bounded task**:

| Profile | Ceiling | Rule |
|---|---:|---|
| Personal | 60 calls | One small whole-app worker while this trial proves the lean procedure |
| Reusable | 90 calls | One planner-defined feature/work item |
| Production | 180 calls | One planner-defined complex work item, never the whole application |

Before the cap, the worker writes a factual handoff: revision, changed files,
accepted/unfinished requirements, command and full result, and next bounded
action. Fix the Kanban lifecycle mismatch found in Trial 3: allow a worker to
block for `iteration_exhausted`, retain the handoff, and make
`_iteration_exhausted()` recognise the terminal state/event that the runtime
actually produces. An unchanged broad job cannot auto-retry; an explicit retry
must name its smaller remaining work.

### Tests

- Saved task ceilings override global 90 through real worker command assembly;
  legacy tasks retain current behavior.
- Exhaustion persists handoff/evidence, lands in the recognised recoverable
  state, and is visible in Studio; it never appears merely as a healthy `ready`
  task.
- Retry loads the handoff and rejects an unchanged broad-phase retry.
- Block-reason validation accepts the bounded exhaustion reason but preserves
  dependency and user-input semantics.

## Slice 5 — live acceptance gates

Run no less than two clean gateway-backed Personal Todo journeys, then one
Production graph-backed journey. Verify the generated application directly,
not from Lyra’s report.

Required measured thresholds for the Personal Todo journey:

| Check | Required result |
|---|---|
| Preview → Development | No queue before explicit user approval/skip |
| Ready task pickup | 0 manual dispatcher commands |
| First real project source file | Within 3 minutes of worker claim |
| Development agent calls | Under 60 calls |
| Ledger discovery | 0 searches outside the project for ledger format |
| Browser verification | One final UI journey, not per-unit assertion loop |
| Completion | Local commit, direct acceptance checks and truthful QA verdict |

The Production journey must prove that a valid graph creates bounded items and
that a complex item can use up to 180 calls without creating duplicate workers
or bypassing approvals. It does not need to spend 180 calls.

## Deferred — only return if Slice 5 proves it necessary

- A Personal task map / multi-card split. Add it only if the lean one-worker
  Personal procedure still exceeds 60 calls or cannot preserve a clear handoff.
- New dashboard scheduler, settings/revision protocol, broad kill redesign,
  automatic swarms, and QA redesign.
- Raising global `agent.max_turns`. It remains unsafe because it affects normal
  chats and unrelated workers; project task budgets are the narrow mechanism.
