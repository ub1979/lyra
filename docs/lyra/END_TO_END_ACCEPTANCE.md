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

### Trial 2 — 2026-09-18 04:16:53 UTC

Frozen source `1e44460c6`: whole-skill delivery fix, 264 scoped tests passed.
Test dashboard restarted on 9121 (exec 87420); user dashboard 9119 untouched.
Started a fresh Pocket Tasks conversation through the UI, preserving trial 1's
31 database messages. Same brief, project, model and personal scope.
Session `20260918_051642_5cb439`. First skill_view returned 21,209 characters;
verify saved JSON integrity and subsequent behavior rather than assuming success.
No app implementation by supervisor. Awaiting requirements response.

Live verification: database skill_view tool result is 21,209 characters and
valid JSON. No persisted preview/recovery loop occurred. API call 1 took 26.4s
(21,453 input / 3,236 output tokens). Call 2 took 141.9s (27,163 input / 15,069
output tokens), then read .sdlc/status.json and .lyra-project. No user-facing
answer yet at that point. Call 3 started 05:19:42 local. UI side panel remained
“Lyra available”, Tokens 0, while the transcript showed working. Distinguish
this latency/status observation from the fixed skill delivery failure.

### First-response latency investigation (user requested)

No project_run calls or background job notifications preceded this delay.
Call 3 took 152.9s (27,556 input / 18,038 output tokens), then wrote the
requirements, prototypes/index.html and project-brain.md, plus a todo update.
Subsequent calls opened the prototype and requested browser_vision. This is
real preparatory work, not a demonstrated dead worker. Calls 2 and 3 alone
accounted for 294.8s (~4m55s); individual metadata reads took ~0.14s.
Output token counts include provider-reported generation, not necessarily
user-visible prose; private reasoning content was not inspected.

Historical source comparison: July requirements skill was 17,591 bytes vs
20,042 today. Current coordinator skill is 24,672 bytes vs 3,680 at its Aug 10
introduction. Size growth is evidence of changed instructions, NOT a measured
causal latency benchmark. Original and current workflows both hand off files
(requirements.md, plan.md, reports); current job prompt still explicitly tells
workers to read them. Old skill also required research/prototypes; do not blame
all preparatory work on new messaging machinery. Need controlled same-model
comparison before claiming which instruction changes cause excessive generation.

UX defect remains observed: tools and generated files advanced while side panel
said available/0 tokens and user saw no explanatory first response. No changes
were applied during trial 2. The generated app was not repaired by supervisor.

### Preview approval — 04:25:26 UTC

Read generated requirements and rendered Lyra's prototype at 1100x850 and
375x812. Layout matches task-list brief; narrow view has no horizontal overflow.
Screenshots: /private/tmp/pocket-preview-desktop.png and pocket-preview-mobile.png.
This is design review, not final functional acceptance. User explicitly asked
to approve. Submitted through the existing pending clarification: approved plan
and look, build final app without preview controls, QA persistence/keyboard/
narrow view. Await confirmed receipt and specialist dispatch. No app edits.

Approval receipt confirmed: clarify completed at 05:25:25 local. Development
worker session `20260918_052601_90f233` started around 05:26:01. Studio displays
one Development job working, with nonzero worker tokens and a saved progress
record. Worker read the prototype and requirements (14,505/8,975-char tool
outputs), so file handoff is observable. No supervisor-written app source.

Post-approval observation (~05:31 local): Development remains working, with
283K cumulative tokens / 7 calls reported. Dependencies and package files exist;
completion is not established. Its last logged completed tool at 05:27:48 was
a terminal dependency check. Meanwhile the coordinator continued browser checks
of the prototype after dispatch, and recorded a prototype filter visibility fix
in the project brain. This is evidence of overlapping coordinator/specialist
activity, not proof of a resulting conflict. Coordinator reached API call 41
while Studio still displayed Lyra available / Tokens 0 beside a working
transcript. Preserve these as latency/role/status observations for later review;
do not silently change Lyra or repair the app during the frozen trial.

At ~05:38–05:39 local the developer had created final HTML/CSS/JS and four
test files, then ran its own tests. Results progressed from 90 passed / 3 failed
to 92 passed / 1 failed. Supervisor made no app edits. A separate confirmed
evidence defect: `npm test 2>&1 | tail -50` returned exit_code 0 and Lyra attached
verification_evidence.status=passed despite visible Vitest failures. The pipeline
can report tail's status; agent/verification_evidence.py classifies success solely
from the supplied exit code. Do not treat this metadata as a passed suite. The
developer is reading failures and repairing them, so this has not yet proved a
false final completion. Review the command-classification/pipeline boundary after
the frozen trial, with regression coverage before any fix.

User approved a subsequent isolated historical comparison: same brief, model,
settings and approval answers, separate project/profile. Candidate July 29
`b196c0397` predates the recoverable-project-jobs introduction (`eed817222`, Aug 29).
Verify actual historical execution path before selecting it. Compare latency,
usage, responsiveness, handoffs and independently checked output quality; other
prompt/context changes confound attributing any difference to Kanban alone.

Development reached 93/93 tests passing at 05:40:43 local. Supervisor reran
`npm test` directly (no pipeline) at 05:41:13: exit 0, 4 files / 93 tests passed.
Independent isolated Chromium against localhost:9132 also passed whitespace
rejection, keyboard Enter add, completion/reload persistence, Active/Completed
filters, 375px no overflow, delete/reload, corrupt JSON recovery and blocked
localStorage handling. No generated source/test/doc edits by supervisor.
Developer committed `c948a7e`, reported completion, and coordinator automatically
received its notification at 05:43:49. Coordinator preflight compression estimated
178,528 tokens (100k trigger), then resumed reads by 05:44:57. QA not yet queued
at 05:45:38. App README says Node 18+ although installed Vitest 5 requires
^22.12 / ^24 / >=26 and jsdom 29 also excludes Node18; route this documentation
finding to Lyra's own QA instead of editing it externally.

Coordinator review found a genuine missing `.filters[hidden]` CSS rule and queued
bounded repair job t_5fb87073 (worker 20260918_054704_d65263), rather than QA yet.
Supervisor submitted the README/toolchain mismatch through Studio at 05:47:53
while this worker ran. Input reached the coordinator; preflight compression
took 73,464ms before resuming. The coordinator recorded the finding and replied,
while the worker continued. This demonstrates concurrent chat intake/background
execution, but not low-latency conversation. By 05:52:24 the worker had committed
85dd72b (hidden filters) and d9ba758 (README runtime guidance). Supervisor did not
author either repair. Independent QA remains pending at this checkpoint.

Repair completed at 05:53:27 after 37 calls; terminal Kanban event ended the
worker loop. Coordinator automatically dispatched QA at ~05:54:57, session
20260918_055457_46093a. Direct supervisor test rerun at 05:54:36 still 93/93.
QA independently confirmed 93/93 and browser smoke; it is checking generated
test-harness isolation/cleanup before completing QA-001. Current code always
creates four serial QA stages even for this personal app (project_work_units.py,
load_qa_work_units); QA-001 alone reached 47 calls by 06:02:46. This is concrete
workflow-overhead evidence, not proof Hermes Kanban dispatch itself is faulty.
Historical checkout prepared at /private/tmp/lyra-july29-comparison, detached
b196c0397. No old-version inference launched concurrently with the live trial.

QA-001 completed 06:03:01 (48 calls). QA-002 auto-started 06:03:57, worker
20260918_060357_79fc3f, and completed 06:18:24 (71 calls), app commit 7be6169.
Expanded suite: 108 passing tests, 15 new boundary cases; evidence records
contrast findings and real-browser work deferred to QA-003. Do not treat job
completion as final acceptance. Two QA stages alone took ~23 minutes.
Studio reload during QA-002 recovered the existing conversation and live worker;
no new user prompt was sent by the reload. Coordinator token display changed
from 3.41M to 'Not reported yet' while worker usage remained visible. Logged as
a separate reconnect/accounting observation, not lost work.

### Context growth audit — user requested, read-only

Confirmed estimator/request mismatch, not merely excessive prompts. Before the
first coordinator compression, last provider input was 52,897 tokens (05:32:17),
but preflight estimated 178,528 at 05:43:49 against the coordinator's 100k cap.
Compression took 52.713s. The next compression took 73.464s. Configured model
capacity in these logs is 1,048,576, so this is a coordinator policy trigger,
not evidence that the provider's full window had been exhausted.

Read-only reconstruction of 92 saved pre-compression messages (timestamp before
04:43:49 UTC) using the real estimate_messages_tokens_rough function:
- Stored history: 156,457 rough tokens.
- Same history after copy_reasoning_content_for_api with this custom/GLM/local
  endpoint's non-echo policy, then removal of storage-only reasoning: 34,507.
- These are history-only estimates; exclude system prompt, tool schemas and
  unavailable image sidecars. Not an exact captured HTTP request reconstruction.
- 30 rows each stored identical reasoning and reasoning_content strings:
  239,777 characters in EACH field. Only aggregate lengths/equality were
  inspected/reported; private reasoning text was not displayed.

Source: turn_context.py estimates raw messages before conversation_loop.py
builds API messages. model_metadata.py's estimator retains non-image fields.
conversation_loop.py removes storage-only reasoning; agent_runtime_helpers.py
strips reasoning_content for providers without echo-back requirements. GLM on
the local custom endpoint does not match the DeepSeek/Kimi/MiMo echo gates in
run_agent.py. Therefore these stored fields inflate the preflight estimate even
though this provider request does not replay them. Other providers may REQUIRE
reasoning replay: do not globally delete reasoning or change persisted history.

Real overhead also exists: initial provider request already 21,453 input tokens;
app-it coordinator skill is 24,672 bytes (~6k char/4 tokens, not exact); loaded
requirements skill returned 21,209 chars. Before first compression, tool results
totaled 55,515 chars and tool-call arguments 56,256 chars. These are substantially
smaller than the duplicated stored fields. Across the saved coordinator records
at audit time, four job-update notices totaled only 5,521 chars (max 1,555 each);
notification payload size is not the dominant observed source. Counts across
compaction records must not be presented as one live request.

Recommended next fix investigation (NOT implemented): estimate the same
provider-facing message representation used for requests, preserving echo-back
providers, images, tool schemas, api_content and prompt-cache invariants. Add
real-path regression tests for GLM/custom vs required-replay providers before
changing compression decisions. Separately reduce unnecessary coordinator
reads/work and scale QA effort to project size; retain complete required skills.
Do not just raise the compression cap or destructively prune stored history.

### Historical comparison started in parallel — 2026-09-18

User explicitly approved parallel execution. July29 b196c0397 checkout is clean
at /private/tmp/lyra-july29-comparison. `npm ci --offline --ignore-scripts` used
its committed lockfile; historical Ink bundle rebuilt successfully. Dashboard
uses historical tracked web assets, localhost:9123, exec session 10735.
Separate HERMES_HOME=/private/tmp/lyra-july29-profile, project parent
/private/tmp/lyra-july29-projects; no current project/history/memory copied.
Minimal isolated config uses same ollama-local / glm-5.3-flash:cloud endpoint
and enables historical ultimate-builder plugin. Python dependencies reuse the
installed venv; verified main.py and run_agent.py import from historical checkout.
This dependency reuse and fresh profile are comparison caveats, not a fully
reproduced July machine image. Source unchanged; no old fixes cherry-picked.

Visible historical UI controller /private/tmp/lyra-old-comparison-control.mjs,
exec 86955. Created Pocket Tasks through New project and the original default
MVP workflow (5 skills: requirements, development, QA, documentation, coordination).
Submitted identical brief. Historical startup internally submits setup prompt;
model turn confirmed at 08:50:48 BST, session 20260918_085048_597cdf, correct
custom endpoint/model in isolated log. Historical dashboard URL:
http://127.0.0.1:9123/chat?guided=1&workspace=%2Fprivate%2Ftmp%2Flyra-july29-projects%2FPocket+Tasks
No prototype approval or app edits by supervisor yet. Current trial untouched.
Parallel inference can affect provider latency; compare work/calls/quality and
treat wall-clock differences as confounded. This compares historical product
behavior, not a Kanban-only controlled experiment.

Historical run at 09:21 check: first model call finished 08:52:07 (78.6s,
23,611 input / 7,544 output), search_files completed, then pending clarify asked
whether to add inline edit / clear completed / both / neither. The guided UI
showed a disabled 'Preparing the project conversation…' composer and no question.
Thus the long gap is awaiting user input hidden by historical guided UI, not
proven provider slowness or Kanban failure. Supervisor found the pending public
tool question in saved tool_calls and selected option 4 via the existing Ink
Terminal input quick-pick mechanism; receipt must be verified. Keep this
assisted recovery explicit in comparison timings. No historical code change.

Follow-up: old session resumed after the answer at 09:23:26; API call 2 took
19.9s (23,872 input / 1,584 output). It produced a requirements summary and
said it was ready for approval, but the historical guided UI still showed only
“Preparing the project conversation…” / “Let’s start building” and no approval
control. Do not count old development as started until explicit approval is
delivered and a worker/file change is observed. Current polished run completed
its final QA recheck before this note; delivery status is checked separately.

User authorized approval of all old-version workflow requests for comparison.
At 09:39:24 the old pending approval completed with option 1, “Approve — build
it as specified,” via the existing Ink terminal input/Enter path. The submitted
typed approval was not represented verbatim; record only the received choice.
Old version may now build the preview. Existing historical UI delays (15m38s
between its requirements prompt and delivered approval) are interaction-surface
delay, not model latency. Continue to classify separately.

Old version resumed the approved flow: API call 3 finished 09:40:24 (59.6s,
24,497 input / 4,616 output) and wrote requirements.md immediately after.
The next provider request began 09:40:26, consistent with preview creation.
This is the first observed old-version project output; two prior long waits
were the hidden clarification and hidden requirements-approval interactions.

At 12:34 the comparison browser was reconnected to its historical workspace;
the ordinary Message Lyra composer was then available. Plain `approve` was
accepted and completed the preview clarification. The recorded clarify duration
was 10,333.60 seconds: this is mostly elapsed time awaiting available UI/input,
not model execution. Old API call 7 took 7.6s, loaded the 16,462-char developer
skill, call 8 took 31.8s, and it recorded intent to dispatch its development
delegate. Historical old UI's visible smart-default button previously did not
send while its guided-agent-ready state was false; reconnect made the normal
composer usable. Preserve as UI/state evidence, no code change.

### Approval-clock method — comparison rule agreed by user

Record two clocks: (1) active Lyra elapsed time from a prompt/approval answer to
the next approval request; (2) user/UI wait from request until receipt of an
answer. Only clock 1 is a speed-comparison measure. Clock 2 remains a usability
finding but is excluded from model/workflow execution timing.

Exact old-version milestones, local time:
- 08:50:48 initial setup/brief → first optional-scope question issued after
  API call 1/search at ~08:52:08: ~1m20 active.
- User answer receipt 09:23:26 → requirements summary/approval request issued
  after API call 2 at 09:23:46: ~20s active.
- Requirements approval receipt 09:39:24 → preview-ready approval request
  presented at 09:42:14: ~2m50 active (API calls 3–6 + static preview writes).
- 08:52→09:23, 09:23→09:39, and 09:42→12:34 include waiting for inaccessible
  historical UI input; exclude from speed measure, retain as UI evidence.

Current-run reference: initial brief receipt 05:16:52 → combined plan/preview
approval presentation at 05:22:54: ~6m02 active. Its approval receipt was
05:25:25. These flows are not identical (current combines requirement+preview
review; old has scope question then requirement approval then preview approval),
so use the values as evidence, not an apples-to-apples benchmark.

### Product direction agreed during comparison

Lyra must not automatically treat every request as an enterprise programme.
At project creation, it should offer a small, understandable workflow as the
default: a single capable builder or a compact MVP path.  The user should be
able to choose the team shape (for example, one builder, builder plus QA, or a
larger specialist workflow) before work begins, with Lyra explaining the time
and reliability trade-off in plain language.  Automatic expansion to a larger
team should require a concrete need, such as platform-specific work, security
review, or a genuinely broad scope—not merely a generic project request.

This is a product/design requirement found through the trial, not a code change
made during it.  The current and historical runs remain frozen so their timing
and outcomes can be compared fairly.

### Historical-run completion status — 12:50 BST observation

The historical developer did create the functional app, styles, core and DOM
tests.  Its project progress record says development is verified with 68/68
`node --test` passing and browser reload persistence verified; the workflow
then started QA.  This supports the narrower finding that the old flow reached
implementation quickly.  It is not a clean overall win: the developer ended
at its hard `max_iterations_reached(50/50)` limit at 12:43:45, and the first
QA worker also hit 50 calls shortly afterward.  Continuation workers were
started, and one encountered missing historical QA-skill lookups before a
fresh QA delegate began.  The project is therefore still being assessed, not
accepted as complete.  Treat the caps/restarts as historical workflow evidence,
not as an excuse to modify either frozen comparison run.

### Preliminary cause isolation — why the old flow answered sooner

This comparison is intended to identify what to keep from the historical flow,
not to declare the historical release better overall.  The initial evidence
rules out one tempting explanation: Hermes Kanban did **not** cause the new
run's six-minute first visible response.  In the current session, the first
`project_run` (the Kanban boundary) was not invoked until call 10 at 05:26:00,
after the user approved the preview.  Its first visible approval presentation
was instead delayed by the coordinator's pre-approval loop:

- new run: call 1 finished in 26.4s, then it loaded the 21,209-character
  App-IT playbook and searched the workspace; call 2 produced 15,069 output
  tokens over 141.9s; call 3 produced 18,038 output tokens over 152.9s; it then
  performed additional file, browser-navigation, and browser-vision work before
  replying after call 8 at 05:22:54;
- old run: its first model call took 78.6s (23,611 input / 7,544 output tokens)
  and then immediately presented the optional-scope question.

The new run's initial input was actually smaller (21,453 tokens) than the old
run's first input (23,611), so input prompt size alone cannot explain the
observed gap.  The direct cause is extra serial coordinator work and two very
large pre-approval completions, with the mandatory full App-IT playbook and
automatic preview inspection providing the opportunity for that behavior.
Kanban remains a separate hypothesis for later-phase latency/recovery/QA cost;
it must be measured after the old run's QA completes.

Current source also confirms a second, separate scope problem: although the
App-IT playbook describes `personal` as a bounded MVP fast path, its current
`load_qa_work_units()` function unconditionally creates four serial QA jobs
(QA-001 through QA-004) and takes no project profile.  That cannot cause the
first reply, but it explains why a tiny personal app later receives an
enterprise-like QA pipeline.  This is a confirmed design mismatch to fix only
after the frozen comparison, with profile-aware tests.

### Requirements-interview finding — 2026-09-18

The current trial did load `req-engineer`; it did not fail to find or run the
Requirements playbook.  The first public assistant response explicitly said the
brief was complete and that it would resolve remaining gaps under the user's
“simple defaults” instruction.  The brief said “Choose simple defaults and the
smallest useful team.”  The Requirements playbook permits the distinct explicit
instruction “Use smart defaults” to resolve every remaining question, and the
App-IT guide describes smart defaults as a permitted interview-collapse path.
The user subsequently confirmed that this behavior is desired: when they allow
Lyra to choose sensible defaults, it should avoid redundant questions and move
straight into planning.  Therefore this is **not** a requirements-policy defect
and the historical wording should not be changed merely to force an interview.

The actual defect is progress communication.  Immediately after deciding to
use defaults, Lyra should send a short visible message such as: “I have enough
to proceed. I am using simple defaults for [brief list], preparing the plan and
preview now; this may take about five minutes.”  It can then do the existing
requirements, plan and preview work without making the user wait silently.
When the user has *not* granted defaults, the existing one-question-at-a-time
interview remains the correct behavior.  Delivery scale (MVP/balanced/full
team) remains a separate decision from both requirements discovery and this
progress-message requirement.

### Reviewed corrections and active plan — 2026-09-18

The entries above preserve observations and preliminary interpretations in
chronological order. The following corrections supersede conflicting claims:

- The 21,209-character loaded result was the Requirements (`req-engineer`)
  playbook, not App-IT. The current assistant wrote public interim messages,
  including “Requirements work is starting now.” Studio does not handle the
  gateway's `message.interim` event. Validate and repair that display path;
  do not infer that the model failed to communicate or that planning time was
  entirely wasted. Permission to choose defaults remains valid.
- The historical database contains two root sessions for the same workspace:
  `20260918_085048_597cdf` and `20260918_123533_c64707`. After the latter began
  at 12:35:48 with `approve`, both launched delegates into the same project.
  This followed manual reconnection/approval recovery; the underlying cause
  is not established. Later timing/output is not a clean single-run benchmark.
- Missing QA-skill lookups and local learned-skill edits also appeared in
  Hermes background learning (`bg-review`), which shares worker session IDs.
  Bundled-skill write attempts were rejected. These events do not establish
  that active QA corrupted its governing instructions. Preserve learning and
  its existing safeguards.
- The existing launcher already offers profiles and agent selection, but
  Studio drops `build_profile` when rebuilding the setup seed. Fix propagation
  and persisted selection authority rather than inventing another setup flow.
- QA will have two proposed user-selectable scopes: Functional (behavior,
  data, failures) and Experience (interface, responsiveness, keyboard use and
  accessibility). Either or both may run, with independent reports and honest
  coverage labels. Existing four-stage jobs retain their recovery semantics.

Use the [reviewed comparison report](2026-09-18-end-to-end-comparison-report.md)
and [revision 3 plan](2026-09-18-reliability-and-workflow-plan-v3.md) for the
slices it describes; those slices are implemented locally. The active follow-up
is [bounded project execution plan, revision 6](2026-09-18-bounded-project-execution-plan-v6.md).
Revisions 1 and 2 are superseded references. These document changes
implement no product fix and make no release-readiness claim.

### Trial 3 — isolated Studio Todo journey, 2026-09-18 (in progress / failed development attempt)

This is a fresh, isolated real-browser journey using the same Pocket Tasks
acceptance brief as the earlier trials. Its generated project is
`my_projects/Pocket Tasks Acceptance C 20260918`; its temporary Hermes profile,
session database, job database, screenshots, and logs are outside the normal
user profile. No production source was changed by this trial.

Observed facts:

- The normal Studio composer delivered the brief. Requirements were generated
  with the chosen `Personal / one-off` profile and correctly constrained the
  implementation to a local, dependency-free HTML/CSS/JavaScript Todo app.
  The requirements approval was submitted through the normal Studio composer.
- Preview files were generated and browser-inspected. The final public preview
  response said the development job was already queued; it did **not** present
  a clear, separately actionable preview-approval checkpoint. This is a
  confirmed workflow/communication regression relative to the intended
  requirements → preview → explicit approval sequence.
- In this isolated dashboard-only run the Development task remained `ready`.
  The dashboard test process did not pick it up. A single supported
  `hermes kanban dispatch --max 1` pass started it. This proves an integration
  gap in the test surface (dashboard-only versus the gateway-owned dispatcher);
  it does not yet prove that a normally running user gateway has the same gap.
- Once started, the `sw-developer` worker produced partial source and test
  files (`index.html`, CSS, separated `js/` units, and browser test files),
  but it did not complete. It hit its configured 90-call iteration limit at
  21:40:51 with task status returned to `ready`, `consecutive_failures = 1`,
  and error `Iteration budget exhausted (90/90)`.
- The recorded worker usage at failure was 90 API calls, 1,006,605 cumulative
  input tokens, 32,739 output tokens, and 5,169,920 cache-read tokens. It took
  roughly four minutes after worker start before its first source/test files
  appeared. This is a confirmed efficiency and progress-visibility failure for
  a tiny static app; liveness heartbeats alone were not meaningful evidence of
  forward progress.
- No independent browser acceptance of the generated app has been claimed.
  The partial build must not be described as complete, correct, or release
  ready. Resume/retry only after investigating why the developer consumed its
  entire call budget in planning, browser self-inspection, and test iteration.

Follow-up questions raised by this run (not yet root causes): bound the
developer's planning/self-inspection loop for the Personal profile; give the
user a visible progress event when the first project file is written; preserve
an explicit preview approval gate; and exercise ready-task pickup through the
same long-lived gateway process that ordinary Studio users run.

### Trial 3 — source-supported cause analysis, 2026-09-18

The call cap was a safety brake, not the original defect. The evidence and
current source identify three independent causes. Do **not** raise the 90-call
cap as a remedy: that would make the same oversized job consume more time and
tokens before it fails.

1. **Personal reaches requirements and QA, but not Development.**
   `project_runs.py` uses `build_profile` when selecting QA work units, but
   Development calls its work-plan loader without the profile and always loads
   the same `sw-developer` skill. That skill requires stack/design playbooks,
   house-standard artifacts, strict per-behavior TDD, full-document reads and
   browser verification for a UI project. The Requirements playbook has a
   Personal shortcut; the developer execution contract has no equivalent.
   This is a confirmed scope mismatch. It strongly explains excessive overhead
   but does not, by itself, assign every one of the 90 calls to a specific tool.

2. **No task graph means a whole-phase job.**
   `load_development_work_units()` returns no units when no task graph exists
   (or it has fewer than two headings). The queue then falls back to one broad
   `Lyra project: Development` task. This trial was exactly that path. The
   intended work-unit/hand-off system only becomes available after a graph
   exists, so it cannot protect the first small project attempt.

3. **The apparent 12-turn worker bound does not bound the first real agent
   loop.** `goal_max_turns` limits the outer goal-loop continuation mechanism;
   the worker's initial conversation still inherits the global 90
   `max_iterations` setting. Worker launch supplies no task-specific inner
   iteration override. The worker therefore spent all 90 calls inside its first
   broad phase before the outer limit could help. The resulting `ready` state
   with one failure is the recovery behavior after the cap, not evidence that
   it completed or that a retry should repeat unchanged.

Separate workflow findings:

- The App-IT playbook asks for explicit preview approval, but the scheduling
  boundary records/checks no preview-approval state. A coordinator can therefore
  queue Development based on its own reading of prose. Requirements approval
  must not double as visual approval.
- Kanban wake-up writes a marker; the long-lived gateway owns the actual
  dispatcher loop. The dashboard-only trial had no such loop, so its ready task
  could not start until a supported manual dispatch pass was run. This is proven
  for the test surface, not yet for a normal user session that has a gateway.

Narrow repair order proposed from this evidence:

1. Persist and enforce a distinct preview-approval checkpoint at Development
   queue time, reusing the existing typed clarification/request-ID mechanism.
2. Make personal projects supply a compact, explicit 2–4 item development map
   before queueing—without running the full task-planner programme—and reuse the
   existing dependency scheduler, per-item evidence and retry hand-off.
3. Pass the selected profile into the developer prompt/contract. Personal
   should reuse the approved design, build only approved behavior, run relevant
   automated checks plus one browser journey, and commit evidence; it retains
   engineering standards but omits irrelevant ceremony.
4. Add a per-work-item inner iteration budget using the existing agent limit
   mechanism, and require an exhaustion handoff to name remaining acceptance
   criteria. Never repeat an unchanged 90-call broad task.
5. Test through a real long-lived gateway and surface its existing
   dispatcher-presence diagnostic in Studio. Do not create a second scheduler
   inside the dashboard.

Before implementation, capture the worker tool trace to distinguish repeated
reads, browser setup failures and useful repairs, then make each repair a
separate change record and verified local commit.

### Trial 3 — trace correction and active repair order, 2026-09-18

The requested worker trace is now available from the Trial 3 database. It
corrects the tentative source-supported explanation above. The Development
worker made 46 browser navigation/console calls while exercising its own test
page, 22 code/test writes, 12 searches through Lyra and an older project for
the progress-ledger format, and about 10 other read, command and job-update
calls. It loaded two skill documents, read the preview once, and took no
screenshots. The coordinator—not this worker—inspected mockups.

Accordingly, do not diagnose this run as repeated skill loading, preview
self-review, or a general "heavy workflow" loop. The concrete missing inputs
are the supported ledger format and one deterministic terminal-first test
command. Passing the profile into Development may explain the strict
test-first/browser choice, but that causal link remains an inference to test,
not a proven cause.

The normal-run dispatcher gap is also confirmed. Trial 2 was claimed by the
machine's gateway, which then received an unexpected signal at 16:56 local
time and exited expecting systemd's `Restart=on-failure`. On this macOS
machine no LaunchAgent was installed, so nothing restarted it. A dashboard
warning alone would leave normal Studio tasks ready forever; the repair must
provide a user-initiated managed runner start/repair action using the existing
gateway/launchd path, with one dispatcher only.

The active, implementation-ready order is
[bounded project execution plan, revision 5](2026-09-18-bounded-project-execution-plan-v5.md):

1. enforce a user-owned preview approval/skip checkpoint, including normal
   composer answers received after the current preview snapshot;
2. surface runner presence and a user-initiated macOS managed-gateway repair
   path;
3. give the single Personal Development worker its ledger template, terminal
   test contract and scoped profile procedure;
4. persist an inner per-task call budget and atomically repair the exhaustion
   block-reason/lifecycle mismatch; and
5. run two measured Personal journeys and one bounded Production journey.

A Personal task map is deliberately deferred. It returns only if the lean,
one-worker Personal journey still cannot complete under its measured 60-call
ceiling. This avoids multiplying the roughly ten startup reads for a tiny
five-file application.

### Revision 6 corrections — 2026-09-18

Review of revision 5 against source found six integration gaps; revision 6
([bounded project execution plan, revision 6](2026-09-18-bounded-project-execution-plan-v6.md))
supersedes revision 5 and the repair order above:

- Personal keeps the 90-call safety limit for the next trials; 60 calls is a
  performance target, not a stop.
- `agent/turn_context.py` resets the iteration budget every turn, and goal-mode
  workers continue for up to 12 Development turns, so a per-turn `--max-turns`
  does not bound an attempt. Attempt-wide budgets are required before the
  Production journey.
- The dispatcher-presence probe reports healthy when its own probe fails and
  does not prove lock ownership or ticks. Health becomes running, unavailable
  or unknown, backed by lock ownership, a tick record and proven task pickup.
- The test contract is one repeatable project test command with a reliable
  exit status, rerun after repairs, for every profile; the prescribed
  "zero-install test page run once" is removed.
- Preview approval is created and validated by the backend and enforced inside
  `queue_project_run`, with defined behavior for existing projects, non-UI
  projects and previews edited after approval.
- Correction to an earlier claim that Trial 3's handoff was lost: the runtime
  already recorded exhaustion itself and saved a 2,727-character handoff on the
  run, marked "unverified handoff, NOT completion". The task has two allowed
  attempts, and the retry receives that handoff. The actual gaps are that the
  plugin's exhaustion check only recognises `blocked`, so the task appears as a
  healthy `ready` task, and that the retry reuses the same body and budget. No
  model-callable block reason is added; the retry policy is an explicit
  decision in revision 6.

No product code was changed by these corrections.
