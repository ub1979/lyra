# Tiny Calculator — live Lyra acceptance trial

Follow-up: [big-picture diagnosis and proposed action plan](2026-09-19-reliability-synthesis-and-action-plan.md).

Status: **Journey completed; functional checks pass, clean acceptance fails.**
The duplicate approval and first-file latency target failed. This is not a
release sign-off. Product code stayed frozen throughout the trial.

Frozen candidate: `9e0ae49ea2dadb59eebf100251ec12ead5176bf5` (local 0.19.63).
Trial home: `/private/tmp/lyra-calculator-20260919-8EF5dk/hermes-home`.
Same configured provider/model: local Ollama, `glm-5.3-flash:cloud`.
One isolated gateway owns dispatch; one Studio coordinator owns the project.
No manual Kanban dispatch, direct application edits, or production restarts.
No product-code changes during this trial. Findings need a trace-supported
cause and affected-path analysis before a repair is proposed.

## Final outcome

Lyra built and finished the app itself. The observer supplied approvals and one
status question, not application code or manual dispatch. All three workers
finished with zero retries and cleared their PIDs. Final delivery at
**00:44:06 BST** survived browser reload and exists exactly once in SQLite.
Both databases returned `quick_check=ok`. No SQLite I/O failure or context
compression was observed. Normal Lyra on port 9121 was not restarted.

| Measurement | Result |
|---|---|
| Start → final delivery | **39m38s**, including about 1m45s approval waiting |
| Development | **12m57s, 44 calls**; <60-call target passes |
| First test/source file after worker claim | **6m55s / 7m24s**; 3-minute target fails |
| Personal QA | **9m49s, 41 calls**, exactly one stage; one app defect repaired |
| Documentation | **8m21s, 47 calls**; 891 lines across README + six guides |
| Coordinator | **70 calls** across turns, including 29-call verification detour |
| Status question while worker active | **7.2s** reply; worker uninterrupted |
| Independent final unit suite | **39 pass / 0 fail**, direct command, exit 0 |
| Independent real browser checks | Arithmetic, errors, Clear/focus, Enter, 320px, offline pass |
| Phase dispatch / terminal worker cleanup | Automatic; 3 done, 0 retries, 0 active worker PIDs |
| Browser coverage | Chrome/Firefox in QA; observer Chromium; **Safari untested** |

The main-loop log contains **202 model calls**, about **12.43M cumulative
input+output tokens** across coordinator and workers. That repeatedly counts
cached input; it is NOT a 12M-token context window or a billing estimate.
Auxiliary judge/title/learning usage is not included in that figure.

Generated app: trial-root `projects/Tiny Calculator/index.html` (open directly).
Final app commit: `e9b680f`. Final independent test rerun: 39/39, ~41ms.
Evidence: `ui-events.jsonl`, screenshots, `qa-harness-evidence/`, profile logs,
SQLite stores and generated project Git history. The root-cause section below
separates confirmed contract gaps from model latency and test-harness mistakes.

Cleanup at 00:46 BST: stopped only the isolated dashboard/gateway and observer
browser. Port 53565 and the worker's temporary HTTP port 8080 have no listener.
Dashboard exit 130 / KeyboardInterrupt was the observer's deliberate shutdown,
not a spontaneous product crash. All generated files and evidence are retained;
the full Playwright `trace.zip` is large (~733 MB). No Lyra source edits,
commits, version bump or push in this trial; this report is a local saved file.

## Scope chosen by the user

A very small calculator, replacing Pocket Tasks for this trial: two labelled
number inputs, add/subtract/multiply/divide, calculate and clear; decimals and
negative numbers; understandable handling of blank/invalid input and division
by zero. Personal profile. No accounts, backend, persistence, deployment or
extra features. Responsive layout and keyboard operation. One repeatable test
command and short run instructions. Explicit requirements and preview approval.

## Evidence to collect

- First acknowledgement, question/approval, user wait, provider and worker times.
- Profile propagation, approval enforcement, actual claim without manual dispatch.
- First source file within 3 minutes of claim; Development target <60 calls,
  hard attempt ceiling 90. No ledger-discovery searches outside the project.
- Independent arithmetic/error/reset/keyboard/mobile checks, not just QA claims.
- Browser reconnect while working: no duplicate job/coordinator or lost replies.
- Separate coordinator/worker usage; unknown is not zero; terminal QA verdict.
- Saved handoff and job/process state if an attempt fails or stops.

This small happy-path trial cannot prove every recovery/enterprise branch.
Managed macOS service restart and deliberate process failure are separate checks;
the isolated test gateway does not install a LaunchAgent in the user's account.

## Chronological log

- Setup: native browser-control bridge unavailable. Use Playwright against the
  actual Studio UI, not direct model/tool/API dispatch. Logs and SQLite reads
  are diagnostics only. No application source will be supplied by the observer.
- 00:01–00:04 BST: isolated gateway PID 34591 holds the test board dispatcher
  lock and publishes successful completed ticks. Studio at
  `http://127.0.0.1:53565`. Created Tiny Calculator through New Project → Fast
  first version, Personal profile. Default team: Requirements, Development,
  QA and Documentation. Workspace: trial-root `/projects/Tiny Calculator`.
  Browser-driver PTY hit macOS's input-line length bound before submitting the
  creation command; cleared it and used shorter commands. This was observer
  harness overhead, not a Lyra failure or model-response timing.
- 00:04:28 BST: explicitly submitted Start through Studio composer. New Project
  preserved the setup brief but did not automatically send it (intentional
  user-triggered startup; not counted as an LLM stall). Session
  `20260919_000400_351a2f`. Working indicator appeared immediately.
- 00:04:40: first request finished in 12.1s (21,448 input / 1,310 output tokens).
  Full Requirements skill loaded (21,209 characters). Public interim greeting
  acknowledged Personal and smart defaults; visible in main chat by 00:05:14.
  Observer sampling establishes visibility, not an exact event-to-render SLA.
- 00:06:31: fifth API response presented requirements and a typed clarification
  approval. No application source or worker had started. Requirements use
  dependency-free HTML/CSS/JS and Node's test runner, with the requested error,
  keyboard and mobile behavior. Calls 1–5: 12.1+47.3+3.1+46.8+11.1 = 120.4s
  model time. The "one-page" brief is actually about 150 lines; record overhead
  without treating document length alone as a fault.
- 00:06:59: requirements approved through the real composer, explicitly not
  approving Development yet. About 28s approval waiting is excluded from active
  model time. Awaiting the separately approved visual preview.
- 00:07:44–00:08:25: three static preview files created and browser-inspected by
  Lyra (cover plus light/dark alternatives). Observer inspected light design
  independently; labels, hierarchy and controls match scope. No queued tasks
  before approval (`.venv` Python SQLite read). System SQLite CLI cannot read
  this DB even outside sandbox while runtime Python can; that reader failure
  is not evidence of a product database fault.
- 00:08:25: separate preview choice shown through clarify. At 00:08:56 approved
  Look A through composer. No backend preview checkpoint file yet; observe
  how the queue boundary handles the model's direct clarify path.
- **Confirmed workflow defect, 00:09:12–00:09:23:** first queue refused because
  the preceding direct `clarify` was not a backend preview checkpoint. Lyra
  recovered by calling `project_run(action=preview)` and asking for a SECOND
  preview approval. The guard worked and created no task before valid approval,
  but the user already approved the same design. New official question token
  `3bbb4f`; observer confirmed with literal `Approve` at ~00:10. Trace/source
  points to inconsistent approval instructions, not a dispatcher failure:
  launcher seed says to present a plain preview question, while tool schema and
  App-IT skill require backend checkpoint first. Verify which instructions the
  coordinator actually received before choosing a repair; do not remove gate.
- 00:10:13: approved queue created `t_fc28a119`; gateway automatically spawned
  it at 00:10:14.765, worker session `20260919_001015_462fd7`. Zero manual
  dispatch. Reloaded Studio at 00:11:08: transcript survived; one worker remained.
- **Confirmed integration mismatch:** coordinator attempted to finish at
  00:10:25 after dispatch. `agent/conversation_loop.py:6385` instead applies
  `build_verify_on_stop_nudge` to its preview HTML edits. That policy excludes
  prose but not HTML, and (when no canonical command exists) orders a temporary
  script execution. It does not inspect whether this agent has terminal access.
  Coordinator explicitly reported the missing terminal, tried browser checks,
  received another verification demand, and worked around it using `cronjob`.
  By 00:14:12 it had reached call 37 (18 calls beyond its attempted handoff).
  This is not a stuck dispatcher: the Development worker is simultaneously
  active. The mismatch is the generic coding verification policy versus the
  restricted preview-writing coordinator. Do not disable worker verification
  globally as a repair. Also assess why a shell-restricted coordinator retains
  script execution through cron; tool hiding is not a sandbox.
- Additional concrete policy mismatch in that sequence: the OS-safe temp path
  demanded by verification is under `/private/var/folders/.../T`, which
  `write_file` rejects as sensitive. The model then tried `/private/tmp`, and
  cron rejected its absolute script path. These are deterministic tool-contract
  conflicts, not model/network outages.
- **Development startup overhead:** task body says keep approved design but
  provides no selected look. Brain still says awaiting approval. Worker read
  both previews, then searched and scrolled the coordinator session for the
  choice. Its seventh response used 48,349 input tokens; eighth used 53,560
  input / 12,914 output and took 156.5s. No source file by 00:14:43 (~4m29s
  after claim), failing the 3-minute target. This request completed, so the
  long interval is measured model generation, not proof of a hung worker.
  Trace the missing durable design-choice handoff before recommending limits.
- 00:15:44: coordinator finally finished its original turn: 48 model calls,
  2.22M cumulative input+output tokens in UI (not unique context tokens).
  It had attempted to hand off at call 19 / 00:10:25: **29 extra calls and
  ~5m20s** followed verification nudges. It even changed the unselected dark
  preview after approval while Development ran. The worker was not blocked by
  this loop, so these overlapping minutes must not simply be added to worker
  elapsed time. Cron did execute scripts: its early failure was a failed
  assertion, not an absent scheduler; a later result said PASS while the cron
  tool still returned `execution_success:false` (diagnosis pending).
- UI observation: runtime panel says **Lyra available** unconditionally
  (`web/src/pages/ChatPage.tsx:603`), even during the coordinator's long turn.
  Coordinator usage appeared only after completion (2.22M); worker usage was
  live and separate. Before reload a zero appeared; after reload the honest
  `Not reported yet` appeared. Do not call token consumption zero from either
  a missing report or the pre-completion panel.
- Budget cross-check: SQLite task has `max_agent_iterations=90`. The compact
  status `call_limit:null` is NOT its numeric ceiling: source uses that field
  for exhaustion state (`call_limit_state`), so null while running is expected.
- **Confirmed cron outcome bug found through the workaround:** manual run
  `1b2435d89b67` saved successful empty-output result at 00:15:30 and its
  script wrote PASS, yet `cronjob run` returned `execution_success:false`.
  `tools/cronjob_tools.py:_execute_job_now` calls `run_one_job`, then looks up
  `last_status` in the scheduled-job record. Completed one-shot jobs are
  removed; missing lookup becomes `{}`, so success becomes false. Execution
  succeeded; reporting did not. Preserve authoritative execution outcome
  separately from job existence; do not “repair” successful scripts.
- 00:17:12: submitted a brief status question in Studio while Development
  continues, explicitly asking not to interrupt/restart it. This checks the
  user can talk to the coordinator during a background job.
- Status reply completed at 00:17:19.499, about **7.2s after submission**,
  two model calls, no worker interruption/restart. This responsiveness check
  passes. Development response 9 took 145.5s, with 54,429 input / 12,181 output
  tokens; startup delay includes two completed long model responses, not a
  timeout. Source/tests appeared around 00:17–00:18; worker continues.
- Filesystem birth times: first `calculator.test.js` at 00:17:10, about **6m55s
  after claim**; `calculator.js` at 00:17:39 (~7m24s). Failed first-file target.
- 00:19:04–00:19:40: observer independently opened real `index.html` over
  `file://` (not mockup, no server/build). Browser passes: 2+3=5, 10−13=−3,
  −2×3=−6, 7÷2=3.5, 0.1+0.2=0.3; blank/invalid/zero-divisor errors; Clear resets
  both inputs, operation to Add, result/error, and focuses first input; Enter
  computes 6+7=13. At 320px viewport document width is 320px, both buttons
  48px tall, screenshot visually checked; no page exceptions. This is an
  interim independent pass, not yet final QA/delivery acceptance.
- 00:23:11: Development finished normally at **44/90 model calls**, below
  the <60-call target, about **12m57s from claim**. `kanban_complete` stopped
  the conversation immediately; PID 36479 was reaped at 00:23:15 and task
  `worker_pid` cleared. No retry or manual dispatch. Notification reached
  coordinator at 00:23:12.644 (~1.2s after completion). It began review itself.
- Observer independently ran the README command unchanged, without piping:
  `node --test js/*.test.js`: **39 passed, 0 failed**, exit 0 (~41ms).
  Generated project commits `7f30f1e` (artifacts), `15d2b87` (build).
- Evidence-quality caveat: Development's final recorded terminal command DID
  use `| tail -8; echo TEST_EXIT=${PIPESTATUS[0]}; ...` despite the explicit
  no-pipe job instruction. All 39 tests genuinely pass independently here, so
  this is not a demonstrated false-green run. `verification_evidence.db`
  contains no events for this project; canonical-command discovery did not
  recognize these plain Node tests. Do not conflate a model-authored report
  with the verifier's authoritative pass. QA should rerun directly.
- 00:24:08: QA worker session `20260919_002408_6ebd9b`, task `t_4a977182`,
  started automatically after coordinator reviewed source/evidence. Exactly
  **one Personal smoke stage** (`QA-MVP-001`), not the legacy four-stage QA.
  This profile propagation and automatic phase transition pass so far.
- QA did find and repair a real generated-app defect: footer text contrast.
  Observer independently reloaded the app at 00:29:48, measured computed
  `rgb(102,112,133)` on white at **4.97475:1**, and rechecked division. No app
  code was edited by the observer. QA also corrected its own test expectations
  for rounding/scientific notation/native radio keyboard behavior; those are
  harness issues, not all app bugs. By 00:31:05 its terminal evidence showed
  unit 39/39, Chrome 80/80, Firefox 18/18; report/commit still in progress.
- Reasoning-config control: resolving `glm-5.3-flash:cloud` reasoning settings
  against both the normal user's config and the isolated trial config returns
  None (provider default). The trial did not force a higher reasoning effort.
  No provider/compression setting was changed during the run.
- 00:33:57: QA completed; coordinator received its notification in <1s.
  QA worker PID 42091 was reaped by 00:34:07. One smoke stage successfully
  counted as the end of QA. **41 calls**, elapsed about **9m49s**, including one app repair,
  custom harness setup (missing packaged helpers), a Firefox cache-version
  workaround, tests and report/commit work. Safari/WebKit is explicitly
  **untested**, not silently counted as verified. Commits `e4cce6b`, `471031c`.
  Copied QA's external harness/results into trial-root `qa-harness-evidence/`
  for reproducibility; original preserved. No product/app edits by observer.
- 00:35:02: Documentation automatically started, task `t_8b9eb07f`, worker
  `20260919_003502_4f3312`, PID 46791. At 00:35:05 observer independently
  loaded the final app in a separate **offline** browser context at 320px
  and computed 6×7=42 with Enter. No internet/server dependency.
- By 00:37:54, Documentation had spent nearly 3 minutes and 16 calls on
  verification, screenshots, an executable example, README, a separate user
  guide, and was beginning a developer guide. This exceeds the requested short
  local instructions. Unlike Development/QA's profile-aware guidance, its job
  body says generic `README.md and docs`; the Technical Writer skill mandates
  a verified documentation suite. Record **scope/latency overhead**, not a
  hung process. A compact per-phase Personal contract should bound the outcome
  while still loading the full skill and verifying relevant examples.
- 00:43:23: Documentation finished (47 calls); all three jobs now done. Final
  project commit `e9b680f`, clean tree. The coordinator delivered at 00:44:06,
  explicitly retaining the Safari caveat. Observer reran all 39 tests and
  reloaded Studio at 00:45:04: final reply persisted. No source-code changes,
  version bump or push were made to Lyra during this trial.

## Root causes and narrowly scoped follow-up (not implemented during trial)

1. **Preview approval protocol drift.** Setup seed in
   `plugins/ultimate-builder/dashboard/app/index.js:736` tells the model to
   present a plain preview approval, whereas `project_run_tool.py:32` requires
   opening the backend checkpoint first. The runtime blocked the first queue
   correctly, but the mixed instructions led to a duplicate approval. Align
   all entry-point instructions with the existing typed checkpoint; exercise
   actual generated setup seed → clarify response → queue as one regression.
   Startup App-IT content is ephemeral and not included in the DB's base
   system prompt, so its absence from that DB field does NOT prove it was not
   delivered. The conflicting setup seed is confirmed in the actual user turn.
2. **Verification policy/capability mismatch.** Generic verify-on-stop treats
   preview HTML as code and orders script execution even for a coordinator
   constructed without terminal. Two nudges are bounded, but each can cause
   many tool calls: 29 extra here. Reuse the existing verifier with a
   capability-appropriate contract and explicit preview/worker ownership;
   retain real verification for executable app edits. Test a real coordinator
   creating a preview then handing off, not just an isolated nudge function.
   Also reconcile the mandated temp directory with the file tool's path policy.
3. **Missing durable selected-design handoff.** `record_answer` stores only
   approval status/time, not which design was chosen; the worker body has no
   selection and the Brain remained stale. Preserve the authenticated user's
   choice with the checkpoint and pass a compact, authoritative handoff using
   existing project/job storage. Do not copy the whole chat or let the model
   self-authorize approval. Regression: two previews, user chooses A, worker
   receives A without searching conversation history.
4. **One-shot cron success reporting.** `_execute_job_now` reads outcome from
   a schedule record already removed by `mark_job_run`. Use the actual durable
   execution outcome, not continued schedule existence. Test real temporary
   cron storage for both a successful and failed one-shot, plus recurring and
   concurrent claims. Existing immediate-run tests mock a surviving record.
5. **Status wording is not state-derived.** The activity panel's coordinator
   badge always says `Lyra available`. Derive it from existing turn/connection
   state; keep worker and coordinator usage separate and unknown explicit.
  A busy coordinator still accepts input, but that is not proof an immediate
  response is available. Test busy/idle/disconnected/reconnect transitions.
6. **Installed skill dependencies are incomplete.** QA loaded `a11y-audit`;
   its instructions require sibling `../accessibility/` references and
   `../scripts/` helpers. Those exist in the source library but not the fresh
   automatically populated trial home. `tools/skills_sync.py` discovers each
   `SKILL.md` parent and copies that skill subtree only, so shared siblings
   without their own SKILL are omitted. QA's actual filesystem check failed.
   Repair the skill package/dependency boundary using existing distribution,
   not a new scheduler or model fallback. Validate referenced resources in a
   freshly synced home, with user-modified skill preservation. Confirmed source
   files include both WCAG/ARIA references, `measure_render.mjs`,
   `verify_states.mjs`, `contrast.py` and the motion guidance; all are outside
   the copied `a11y-audit` subtree.
7. **Personal scope is not applied to Documentation.** The coordinator queued
   `tech-writer` with `build_profile=personal` (message 375), but
   `worker_guidance.py:73` applies the Personal outcome only to Development;
   Documentation receives the generic full-suite skill contract. It produced
   user/developer/deployment/architecture guides rather than just the requested
   short local instructions. Reuse the existing per-phase guidance to bound
   Personal documentation; do not truncate the skill or add a settings system.
   Regression should assert the actual job instructions include the selected
   profile's documentation outcome, then measure it in another clean journey.

Performance follow-up is separate from those correctness fixes: measure the
two long Development responses and input composition under the same model.
Do not attribute all delay to Kanban, increase call limits, truncate full
skills, or remove testing on the evidence of this trial. The Development
worker finished under the existing call target.
