# Calculator E2E follow-up — 2026-09-19

## Frozen candidate and scope

- Product source: `17ae6a6eb64c3948407bea43f0c75cb95681a3d7`.
- Dashboard: localhost:9121, PID 58956 at trial start.
- Model: `glm-5.3-flash:cloud`, configured provider `ollama-local`.
  Ollama is local; inference for this model is cloud-backed.
- Project created through Studio: `/Users/u/funcoding/lyra/my_projects/Calculator E2E`.
- Session: `20260919_051721_c9f347`.
- Personal / one-off, Fast first version, Requirements / Development / QA / Documentation.
- Lyra authors the application. Supervisor uses Studio for messages/approvals,
  reads evidence, and independently verifies delivered behavior.
- Existing unrelated untracked files preserved. No product code changed in this trial.

## Corrections to earlier reporting

Earlier failed controllers are not product failures: one waited for an empty
Send button to enable; long controller instructions failed to complete; a
status query selected two sidebars and raised a strict-selector error. Do not
count these waits as model latency. The retained controller uses short commands
and checks specific UI elements and session-scoped backend evidence.

At 04:18:00 UTC the initial new-project setup text was visible at the terminal
prompt and no model request had started. Automatic submission is an unresolved
observation, not an established root cause or regression attributable to the
latest changes. This continuation is therefore not a clean-start acceptance pass.

Follow-up read-only check of the persisted first user message: 17,064 characters,
two `IDRAK_INTERNAL_SETUP_BEGIN` markers, and two occurrences of the calculator
brief. The subsequent visible Send appended to the pending initial setup text.
The duplicate input is confirmed; the reason the initial Enter was not consumed
was unresolved at that point. The controlled probes below now reproduce a
product-side connection lifecycle fault. Do not blame the model.

## Verified timeline (UTC)

| Time | Evidence |
| --- | --- |
| 04:17:20 | Studio project created; preparing placeholder visible. |
| 04:18:00 | Ready placeholder and label visible; initial setup text at terminal prompt. |
| 04:18:13 | Brief sent once through visible composer; user bubble visible; matching backend turn starts. |
| 04:18:56 | Backend finishes two model calls; 502-character reply asks single-result versus four-result calculator. |
| 04:20:02 | Browser confirms reply, ready label and 52.6K reported coordinator usage. |
| 04:21:34 | Existing conversation and empty draft checked before continuation. |
| 04:22:05 | Single-result choice submitted; backend confirms second user turn. |
| 04:23:03 | Lyra writes requirements.md; no application source exists. |
| 04:23:14 | Requirements summary and approval question completed (69 seconds for this turn). |
| 04:23:39 | Requirements approved through visible composer. |
| 04:24:59 | Typed preview checkpoint visible; named Clean light and Dark modern choices. |
| 04:25:06 | Supervisor opened actual Clean light preview in a separate browser tab. |
| 04:25:15 | 320px preview inspected: no horizontal overflow, controls readable. |
| 04:25:22 | `Approve Clean light` submitted through Studio's request-bound clarification UI. |
| 04:25:40 | Development queue action completed; runner was not running. |
| 04:26:08 | Studio clearly reports queued work cannot start and offers Start job runner; coordinator also explains it. |
| 04:26:28 | Supervisor clicks Start job runner in the visible activity panel. |
| 04:26:43 | Logs confirm gateway obtains the singleton dispatcher lock. |
| 04:26:49 | Development worker session starts: `20260919_052649_a33de4`. |
| 04:27:35 | UI shows one Development worker, 3 calls / 92.8K tokens; coordinator separately ready / 581K tokens. |
| 04:28:55 | Browser reloaded during Development. |
| 04:29:09 | All 12 chat entries restored; same stored coordinator session; worker remains active. Coordinator usage now says Not reported yet (observation to investigate). |
| 04:30:00 | Worker has created tests/calculator-logic.test.js and is executing terminal checks. |
| 04:30:34 | Status-only question accepted after browser reload, while Development continues. |
| 04:30:48 | Coordinator returns a relevant status in 14 seconds using project_run status; no replacement Development task. |
| 04:30:57 | Calculation logic exists at js/calculator-logic.js (about 4m08 after worker start). |
| 04:33–04:34 | Worker test output reports 40 passing cases; interface HTML/CSS/JS and README written. |
| 04:34–04:35 | Development performs browser checks; at call 38 by 04:35:22. |
| 04:37:55 | Development run 336 completed, no error; 666 seconds (11m06) from start. |
| 04:38:34 | QA task t_092acb9d / run 337 starts automatically, one Personal smoke stage. |
| 04:38:54 | Supervisor arithmetic/error/Clear/keyboard/320px browser checks pass; no page errors. |
| 04:49:46 | QA completes successfully at 90/90 model calls; no retry, 11m12 elapsed. |
| 04:50:03 | Documentation starts automatically (run 338, task t_ffe3fd98). |
| 04:53:43 | Documentation completes successfully, 3m40 elapsed. |
| 04:54:20 | Supervisor observes coordinator's final delivery and Lyra ready / no active jobs. |

Independent verification against the Development artifact: README's `node --test`
passes all 40 tests with exit 0. Browser opened index.html directly via file://;
checked exact results for 2+3, 7−10, −4×2, 9÷3, 0.1+0.2, blank/invalid input,
division by -0, Clear resets values/operation/focus, keyboard-only entry + Enter,
and -2.5×4 at 320px. No horizontal overflow or page exceptions. Screenshot:
`/private/tmp/lyra-calculator-e2e-20260919/app-mobile.png`. Recheck changed behavior
if QA modifies the implementation. No supervisor application edits.

Latency observations: Development call 6 took 70.4s and call 14 took 65.7s.
Two JavaScript patch operations each waited about 10s for fresh LSP diagnostics
which timed out. Worker continued afterward. These are measured costs, not
proof of a stalled process. Coordinator usage returned after the next status
turn; reload usage preservation remains a separate observation.

Read-only job DB check using Lyra's Python SQLite runtime confirms a single
Development task `t_10cbc5bc`, one run `336`, PID `67047` after reload. macOS's
system sqlite3 could not open the live database; the runtime reader succeeded.
That diagnostic-tool incompatibility is not evidence of product DB failure.

The runner was down at dispatch. This run does not meet zero-intervention
dispatch acceptance. Continue by clicking the existing Start job runner UI
action, recording whether normal recovery succeeds; do not dispatch jobs by CLI.

Supervisor read the requirements and UI summary: arithmetic, validation,
rounding, accessibility, offline static app, built-in test runner and short
README match the brief. Requirements and existing team approved through the
composer. Clean light preview subsequently inspected and approved; before that
approval the project contained requirements and preview artifacts only.

First confirmed submitted turn took approximately 43 seconds. Waiting for the
supervisor after its question is user-wait time, not Lyra execution time.

## Acceptance checks still pending

Final saved-chat reload remains pending. QA, Documentation and final delivery
have completed. Requirements/preview approval, Development completion,
independent app checks and an in-progress reload have passed as recorded above.
Initial dispatch needed the Start job runner recovery; QA dispatched automatically.

At 04:46 UTC QA was working at 79 calls, close to its 90-call attempt budget.
It subsequently completed on call 90 without a retry. The trace contains 84
browser tool invocations (24 type, 26 click, 26 console, 5 press, 2 navigate,
1 image retrieval), plus 15 terminal and 13 file reads. Tool invocations are
not the same as model calls: several tools may share one response. QA found
and repaired a border-contrast issue in css/styles.css (a4a4aeb), with report
and evidence updates. Supervisor inspected the actual diff and reran the
calculator's 40 tests successfully. This was active work, not a stall, but
90/90 leaves no budget headroom and is disproportionate for this tiny app.

## Controlled attribution checks (04:52–04:54 UTC)

Two separate new projects were created through the normal Studio form:
Startup Probe 20260919 and Startup Probe Repeat 20260919. A fresh browser
context was used; each brief asked only for acknowledgement, forbade builds
and jobs, and was submitted by exactly one Enter project studio button click.
No composer resend, synthetic Enter, forced click, or product code edit was used.
Passive observation recorded outgoing PTY frame metadata, not private content.

Both remained ready with zero calls, no user bubble, and setup text pending in
the embedded terminal. In the second probe, setup paste was sent at
04:53:44.006; that socket closed at 04:53:44.012, only 6ms later. A new socket
opened at 04:53:44.107. Neither socket sent a submit carriage return. Evidence:
`/private/tmp/lyra-calculator-e2e-20260919/startup-probes.json`.

Source explains this ordering: ChatPage.tsx removes the builder URL parameter
(3399–3401) immediately before writeGuidedPrompt (3413–3417). The parameter
was what made guidedSessionLookupComplete true (1746–1750); removing it makes
that dependency false until session lookup finishes. The terminal effect
depends on that flag (3775), so cleanup closes the socket (3749) during the
paste-to-Enter delay. The writer checks the current socket but closes over the
old socket for send. Changing readiness can therefore skip Enter or target a
closed socket. This is a reproducible Lyra startup lifecycle fault, distinct
from the earlier confirmed test-controller mistakes. Historical blame places
these lines in July/August; that alone is not a historical runtime reproduction.

Runner attribution is different: process inspection shows the test dashboard
was started directly with `hermes dashboard --port 9121 --no-open --skip-build`,
not start.sh. start.sh explicitly starts/checks the gateway; dashboard alone
does not supply that dispatcher. The gateway log reports the previous exit was
clean, and no crash during this trial is demonstrated. The UI recovery worked;
health now reports successful dispatcher passes, and QA plus Documentation
were dispatched automatically. Classify this trial's initial missing runner
as a test-environment/preflight omission, not evidence of a broken dispatcher.

Supervisor diagnostic correction: one test invocation accidentally used repo
root rather than the calculator directory; its broad Node discovery failed and
was terminated/exited. It is excluded from product evidence. The correctly
scoped calculator run passed 40/40. The second startup probe was performed after
that process exited and independently reproduced the connection fault.

## macOS application-modification warning

User reported Python 3.12 was prevented from modifying apps. macOS TCC logs at
05:36:12 BST (04:36:12 UTC) confirm a denied
`kTCCServiceSystemPolicyAppBundles` request attributed to Lyra's bundled Python
3.12.14, responsible PID 66975; requesting process IDs include 71047 and 71059.
The Development trace contains direct installed Chrome and Firefox headless
screenshot commands. It contains no explicit application-bundle modification in
those commands. Browser launch is a possible link, not yet an exact attribution
of the denied filesystem operation or target application. Do not dismiss the
warning as harmless or recommend granting broad permission. No macOS permissions
were changed by the supervisor.

Raw browser observations: `/private/tmp/lyra-calculator-retest-20260919/ui-events.jsonl`.
This file mixes prior controllers; use timestamps and the project/session above.
Do not include credentials or private model reasoning in reports.

## Subsequent fixes (local commits; not a new full-project trial)

- `864a03b59`: preserve the new-project connection through paste and Enter;
  scope all delayed guided writes to their original socket. The actual form
  regression failed before the fix (zero provider requests), then passed with
  one submission, reload and follow-up. Existing two-turn/backend restart smoke
  also passes. 491 web tests and 6 Ink paste tests passed; build/typecheck pass.
- `8cc6c8144`: Personal QA assignment reuses batched real-browser journeys,
  avoids redundant criteria/report work, and retains independent coverage gates,
  failure exit codes and the 90-call budget. All 210 builder tests pass.
  Actual live-model efficiency improvement is not yet measured.
- `STUDIO_TEST_GUIDE.md` now separates full-project runner preflight from
  transport-only CI smoke, and documents the observed testing pitfalls.

No remote push or version bump. User services were not restarted. New frontend
assets require a browser reload; new QA guidance applies to newly queued tasks,
not existing saved task bodies. The macOS warning's exact operation remains
unresolved; no permission changes were made.
