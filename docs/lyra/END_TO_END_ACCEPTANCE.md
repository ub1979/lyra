# Lyra end-to-end acceptance contract

Updated: 2026-09-18. Read this file before resuming this investigation after a
context reset. This is the agreed product objective, not a release sign-off.

## User's objective and decisions

Keep today's useful UI and capabilities. Make Lyra reliably build software with
the user's specialist skills, using Hermes memory, learning and delegation.
Do not replace the current architecture or revert to July merely because it was
simpler. Durable jobs already use Hermes Kanban: distinguish faults in Lyra's
integration from incorrect use of Hermes and genuine Hermes runtime faults.
Do not remove background jobs without comparative evidence and agreement.

## Test project: Pocket Tasks

A small local browser task list, created and visible through Lyra Studio.
Use the existing configured provider/model. No accounts, paid services, camera,
model downloads or deployment. Choose simple defaults when asked.

Acceptance criteria:

- Add a nonempty task; reject empty/whitespace-only titles.
- Mark tasks complete and active; filter All, Active and Completed.
- Delete a task; show accurate counts and a useful empty state.
- Preserve tasks and completion state across a browser reload using localStorage.
- Usable labelled controls and keyboard submission, including a narrow viewport.
- Runnable locally with documented commands and real automated tests.
- No unnecessary backend or production infrastructure.

Lyra chooses a proportionate team and implementation. Requirements and visual
preview approvals are genuine checkpoints: inspect and answer through Studio.
The supervisor may approve sensible choices on the user's behalf for this test.

## Non-negotiable experiment rules

1. Lyra writes AND repairs the generated application. The supervisor must not
   write its source, tests, requirements or reports to rescue a failed build.
2. Keep the current architecture; record the exact tested commit, built assets,
   running backend version, provider and project/session identifiers.
3. Trace user input -> coordinator -> specialist context -> verified output ->
   coordinator continuation -> UI state. Do not treat a heartbeat as progress.
4. Record timing, tool/job identifiers, artifact paths and observed results;
   never store credentials or private model reasoning in this record.
5. Classify failures: application, skill, Lyra integration, Hermes runtime,
   provider, or test harness. Do not assume the owner from the visible symptom.
6. A Lyra change needs reproduction, impact analysis across sibling paths,
   regression coverage and the real failed journey rerun. Prefer existing
   mechanisms; focused responsibilities and new files under 400 lines.
7. Freeze each trial's version. If a fix is necessary, stop that trial, record
   its failure, identify the new candidate and rerun. Never silently mix results.
8. Verify approval pause and browser reconnect without duplicate work or lost
   replies. Verify actual application behavior, not only Lyra's completion claim.
9. Repeat a complete clean project journey on the final candidate. One lucky
   completion, focused unit tests or green CI alone is not acceptance.
10. Preserve user projects and unrelated changes. No blind rollback, restarts
    of active work, architectural switch or unverified release.

## Current evidence and gate

- Source HEAD at plan creation: `0ea7f29e4`, local 0.19.63 candidate, not pushed.
- Studio paste failure exists in both `2994421fa` and `9fdc1358a`: each failed
  2 of 5 identical isolated browser journeys.
- Attempted paste fix has deterministic mounted-hook coverage but is NOT
  accepted: latest clean repeated browser run passed 8/10 and failed twice.
  The model received a collapsed paste label rather than full setup text.
- An instrumented 10/10 run does not supersede the clean failures; diagnostics
  may change timing. See changes/2026-09-18-paste-submission-ownership.md.
- Resolve and repeatedly verify that input boundary before submitting this
  project. Do not bypass the UI or weaken the smoke assertion to obtain a pass.
- Screen Time Buddy is an idle project shell, not this trial. Do not start it.
- Pocket Tasks has NOT been created or submitted. No acceptance is claimed.

## Resume procedure and evidence log

Read this file, CODE_MAP.md, CHANGE_MANAGEMENT.md and applicable AGENTS.md.
Inspect Git status and actual live processes before acting; saved process/session
IDs may have expired. Read the paste change record and reproduce the remaining
failure. Update this section at each milestone with exact evidence and next step.
Do not promise monitoring or work after the active turn has ended.

Next action: diagnose the remaining real Studio input failure; then create
Pocket Tasks in the UI and run the unchanged acceptance criteria above.

### 2026-09-18 diagnostic checkpoint

An isolated checkout with in-memory paste tracing failed 4/5 real browser
journeys. In each captured failure, snippets were populated, updated, then
cleared before submission (roughly 150–210 ms before Enter). Submission saw
the label with an empty snippet list. Trace: temporary local file
`/private/tmp/lyra-paste-failure-only.jsonl` (mock-model test inputs only).
This proves intervening input-state clearing; it does not yet identify the
caller. Startup session reset is a hypothesis, not an established cause.
Adding stack collection changed timing and the next three journeys passed;
three low-overhead caller-tagged journeys also passed. Do not treat these as
a fix. Production source and the running installation were not changed.

Follow-up: a caller-tagged run (9/10 passed) captured initial `resetSession`
with null session ID and `create-complete` between paste and Enter. A mounted
lifecycle test reproduced that exact ordering: startup failed, existing-session
isolation passed. Narrow fix preserves pending paste only for initial create;
explicit reset/resume/replacement still clears it. Four focused suites: 22/22;
typecheck and targeted lint passed. With diagnostics removed, the isolated
candidate passed 10/10 browser journeys. Root Ink bundle rebuilt with this fix.
The input gate is cleared for the project trial, not overall release sign-off.

Runtime caution: dashboard PID 21698 on port 9119 started Sep 17 at 12:09:30;
its displayed version reads current files and does not prove all loaded Python
code is current. Use a fresh controlled runtime for acceptance or explicitly
classify observations from that process as exploratory, not frozen-candidate
acceptance. No user process was restarted.

### Trial 1 started — 2026-09-18 04:01:47 UTC

- Frozen source: local commit `0fb3566e2` (0.19.63 candidate); no push.
- Fresh dashboard PID 73924, localhost:9121, exec session 54051; existing user
  dashboard on 9119 untouched. Root Ink bundle rebuilt after the startup fix.
- Project created through Studio: `/Users/u/funcoding/lyra/my_projects/Pocket Tasks`.
- UI URL: `http://127.0.0.1:9121/chat?guided=1&workspace=%2FUsers%2Fu%2Ffuncoding%2Flyra%2Fmy_projects%2FPocket+Tasks`.
- Personal/one-off, initial team “Let Lyra guide me”, model `glm-5.3-flash:cloud`.
- Brief submitted through Message Lyra, covering the acceptance criteria above.
  UI showed the user message and “Lyra is working”. No app files authored by
  supervisor. Await the first actual response; do not claim a finished build.
- Visible browser controller remains exec session 49159, script
  `/private/tmp/lyra-visible-project-control.mjs`; reacquire if expired.

### Trial 1 FAILED at skill loading; interrupted safely

Session: `20260918_050128_fdf119`. Agent log at 05:01:46 local confirms the first
turn contains the setup block, not the collapsed label. No specialist job was
queued. Source stayed frozen throughout this trial.

Confirmed failure chain (read-only inspection of tool calls/results in state.db;
private model reasoning was not inspected):

1. Coordinator requested `skill_view(ultimate-builder:req-engineer)`.
2. The 21,209-character result became a 1,500-character persisted-output preview.
   `tui_gateway/studio_budget.py` imposes an 8,000-character default result cap;
   skill_view has no exemption. That budget originated in `e8542a434` (Sep 16).
3. Saved output is JSON on one physical line. The initial `read_file` returned
   only 2,164 characters; subsequent offset 25, 24, and 23 reads returned empty
   content. Search was also shortened. The model then navigated a browser to
   the local saved tool result and attempted browser-based recovery.
4. Fourteen tool turns occurred before any useful first reply. At 05:04:42 local,
   supervisor sent Ctrl+C via the existing terminal input. Agent log confirms
   `interrupted_during_api_call`, 15/90 calls; no app source was written.

Classification: confirmed Lyra context-budget/instruction-delivery integration
failure, compounded by file-result line truncation. This trial did NOT test
background-job completion and cannot blame Kanban for the observed first-turn
delay. It also does not establish the cause of every earlier slow turn.

Separate UI observation: during actual calls, side panel said “Lyra available”
and Tokens 0 while transcript said working. After interruption tokens became
357K (cumulative usage, NOT 357K unique context or necessarily uncached billing);
the immediate snapshot still said working. Investigate event delivery/state
separately; do not silently patch the UI during this failed trial.

Next required change: behavioral regression using the REAL requirements skill
through per-result and aggregate budgets, then a minimal instruction-preserving
fix that retains required skill content without removing ordinary output bounds.
Check whole-document handling, multiple skills, small windows, worker isolation,
and prompt-cache invariants. Do not merely raise all caps or teach the model to
recover truncated instructional tools. Repeat the same project journey on a new
identified candidate, preserving this failed trial as evidence. Project remains
unfinished; no release sign-off or push. This supersedes “await first response”.
