# Calculator repairs retest — 2026-09-19

## Frozen candidate and method

- Candidate: `1c2c18460`, Studio displayed `0.19.64 beta`; no product edits or push during trial.
- Dashboard: `http://127.0.0.1:9121`; restarted onto candidate before trial.
- Model: `ollama-local / glm-5.3-flash:cloud` (cloud inference through local Ollama).
- Project: `my_projects/Tiny Calculator Verify 20260919`.
- Personal / Fast first version; Requirements, Development, QA, Documentation.
- UI operated through native Chrome. Initial browser interruptions happened before submission and are excluded from model timings.
- Supervisor will not author or repair generated application files.

## Acceptance

Four arithmetic operations, decimals, negatives, clear, keyboard input,
divide-by-zero error and recovery, labelled controls, narrow layout,
repeatable automated tests and local run/test instructions. Requirements and
actual preview must be approved before Development. Independently exercise
the result; inspect QA evidence rather than accept its summary alone.

## Evidence log

- Setup form verified with intended model and four selected agents. No brief submitted yet.
- Runner health confirmed running before submission.
- Clicked Enter project studio once at approximately 13:06:12 UTC; native UI call returned after 39 seconds.
- Initial brief reached real coordinator `20260919_140651_46e788` at 13:06:52 UTC (log local time 14:06:52), history=0. A model streaming request followed immediately. No resend or hidden-terminal input.
- Studio subsequently showed "Lyra ready", Tokens 0, and its empty-chat greeting while the model request was in flight. Preserve this discrepancy for investigation; it is not evidence that submission failed.
- First model call completed 13:07:38 UTC, 46.0s, 20,439 input / 4,450 output tokens. Clarification asked visual style despite smart defaults; answered clean/minimal at 13:08:27. About 49s user/controller wait excluded.
- Actual requirements approval question appeared around 13:11 UTC; no Development job started. At 13:12 UTC sent corrections through the visible composer. This is a reviewed/assisted requirements journey, not an error-free autonomous draft.
- Requirements file appeared 13:10:42 UTC. Independent inspection before approval found AC-006 mathematically wrong (`8 ± − 3` specified as `5`, should be `-11`), browser-page tests described as a single command, and an approval section falsely claiming explicit document approval already received. No approval had been given. Awaiting actual approval checkpoint; these need normal user feedback, not supervisor source edits.

## Result

Monitoring after user requirements approval. No end-to-end pass claimed.

- At 13:13:19 UTC Lyra corrected the arithmetic, replaced manual browser tests
  with `node tests/run-tests.js` and nonzero failure exit, and changed the
  requirements status to awaiting approval. Independent file inspection confirmed
  those corrections; Studio asked for approval again.
- The computer-use safety reviewer rejected the supervisor's approval action,
  requiring direct user approval. No alternate submission was attempted.
  This pause is a testing authorization boundary, not a Lyra stall. Preview,
  Development, QA, app acceptance and restart/resume checks remain untested.
- User personally approved requirements through Studio at about 13:34 UTC;
  requested monitoring only, retaining approval choices. The preceding roughly
  21-minute approval wait is not model latency.
- At 13:35 UTC Lyra created `classic-light.html` and `soft-card.html` previews.
  One browser navigation returned ERR_FILE_NOT_FOUND; Lyra corrected its URL
  and the next navigation succeeded without supervisor intervention.
- Around 13:36 UTC Studio showed formal preview checkpoint `ad3523`, naming
  both actual preview files, with Approve Classic Light / Approve Soft Card /
  Change / Skip. No Development worker is active before this choice. This is
  an intentional approval pause, not a stall. Preview preparation took roughly
  two minutes after user requirements approval. Supervisor has not yet
  independently checked the rendered previews or application.
- 14:12–14:14 UTC follow-up: Development and Documentation evidence and app
  files exist; development evidence records selected Classic Light approval.
  Independently executed `node tests/run-tests.js` in the generated project:
  exit 0, **27 passed, 0 failed**. This is a rerun of generated tests, not yet
  independent browser acceptance.
- Confirmed long coordinator request: stream started 13:59:21.647 UTC and
  closed 14:10:40.941 UTC (~679 seconds). Runtime logged "Empty response after
  tool calls", nudged the model, then obtained text in 8.6s. The delay lies
  inside the provider-request path; logs alone do not identify whether remote
  inference, Ollama, transport, or local scheduling caused it. Not an approval wait.
- New worker `20260919_151054_faffc2`, task `t_c54b9e5a`, started at 14:10:54
  UTC in this project. Four model calls and real file/terminal reads completed
  by 14:11:17; next request was still pending at latest check. Final QA evidence
  is not yet present. No completed QA or end-to-end pass claimed.
- Monitoring limitation: Chrome was on an unrelated signed-in page. The safety
  reviewer blocked further UI inspection; did not bypass it. Read-only project
  and logs checks continued. Standalone project_run_state returned no tasks
  despite worker logs; board/profile lookup context remains unresolved, so its
  idle result is not used as proof that workers stopped.
- Human-wait attribution rechecked: the long 13:59:21–14:10:40 UTC interval
  follows an automatic `IDRAK_INTERNAL_PROJECT_TASK_UPDATE` turn, completed
  `project_run` and `read_file` calls, and a provider streaming request on
  Thread-175. That same thread closed the request before the empty-response
  nudge. It is not a clarify/approval wait. Wall-clock duration alone does not
  prove 679 seconds of active inference: machine sleep/suspension and transport
  delays remain possible until separately checked. Earlier actual human
  requirements/preview approval waits must stay excluded from performance totals.
- **Sleep cause confirmed by macOS power log:** `pmset -g log` records
  14:59:23 +0100 entering Sleep due to **Idle Sleep**, on AC, for **648s**;
  wake from Deep Idle at 15:10:11 +0100. This overlaps 10m48s of the 11m19s
  outstanding provider request, leaving roughly 31s outside sleep. Therefore
  the long wall-clock gap must not be counted as active model latency or an
  awake Lyra stall. Screen saver alone and actual system sleep are different;
  this event was actual sleep. Lyra continued in the same session after wake.
  No power settings or code changed during this investigation.
- Ollama corroboration: at 15:10:40.936 local its cloud proxy logged
  `cloud proxy response copy failed` / `connection reset by peer`; the next
  completion succeeded in 8.537s. This supports sleep-interrupted cloud
  transport, not an Ollama process crash. Local IPs omitted from this report.
- Release review at 15:18 local: no final QA acceptance artifact yet; no stable
  sign-off or push performed. Source inspection shows macOS idle-sleep guarding
  wraps direct specialist worker lifetimes (`_worker_command_with_idle_sleep_guard`),
  while Electron has its own preference-controlled blocker. This trial uses
  web Studio. Documentation finished at 14:59:17; sleep followed at 14:59:23
  while its coordinator notification response was still in flight. This is
  consistent with a keep-awake coverage gap between worker completion and
  coordinator work, not user-input waiting. No sleep-prevention fix made here.
- 15:21 local QA check: still active, performing browser clicks (17 model
  calls by 15:21:29). A separate 318.69s terminal delay from 15:13:41 to
  15:19:00 was in the command-approval path, not the earlier Mac sleep.
  The blocked command tried a deliberately failing test on copied temporary
  test files via a compound `node -e` shell command. Result says "User denied";
  that text does not prove a human clicked Deny: CLI approval timeout also
  returns deny. Exact timeout versus human denial not established. QA continued
  afterward. No current pending user question is established by these logs.
- 15:55 local: QA worker finished at **15:54:39**. First attempt exhausted
  90 calls at 15:41:03; automatic continuation started 15:41:55 and finished
  after 39 calls. Total QA elapsed approximately 43m45s across two attempts,
  including the previously recorded approval-path delay (not all active compute).
- QA reports Node 27/27 and browser 38/38 passing, no application defects;
  browser daemon timeouts/input delivery and a missing-reset harness defect
  required recovery. These are QA reports, not supervisor-independent browser
  verification. Coordinator received completion and was reviewing reports at
  15:54:48.
- Overall acceptance still needs review: pinned QA criteria list is empty and
  acceptance JSON reports needs-review; approved contrast requirement NFR-003
  was not measured. Functional-only selection does not establish satisfaction
  of that explicit requirement. Therefore worker completion is not stable
  release sign-off. No push performed.

## Independent QA call audit and proposed repairs

Read-only investigation after completion, 2026-09-19. Product candidate remains
`1c2c18460`; no product edits, restart, release or push in this investigation.
The earlier monitoring entries are chronological observations, not the latest
verdict. Counts below use worker session tool-call records and request timings;
model private reasoning is not evidence for the conclusions.

### What the 129 calls actually did

One **Functional QA job**, not four QA stages, ran as two attempts:

| Attempt | Local time (BST) | Model calls | Tool invocations |
|---|---|---:|---:|
| `20260919_151054_faffc2` | 15:10:54–15:41:08 | 90 | 176 |
| `20260919_154155_d71a22` | 15:41:55–15:54:39 | 39 | 58 |
| Total | About 43m45s including the retry gap | 129 | 234 |

Categorising each model call by the actions it requested gives:

| Dominant activity | Calls |
|---|---:|
| Browser-focused, including two mixed browser/tool turns | 85 |
| Context reads, terminal commands and process checks | 31 |
| Writing/patching the browser script and evidence reports | 9 |
| Task bookkeeping | 3 |
| First attempt's final no-tool exhaustion response | 1 |
| Total | 129 |

The first attempt alone spent 79 of its 90 calls on browser-only turns.
Across both attempts there were 108 browser clicks, 18 key actions, 34 console
reads, four navigations and three snapshots: 167 browser tool invocations.
One model response can request several tools; these are not 129 distinct tests.

The first attempt exhausted its 90-call allowance. The existing continuation
worked, preserved the handoff and completed after 39 more calls. Increasing the
allowance would conceal the inefficient method, not repair it.

Logged main-model request durations total approximately 29m20s (18m13s +
11m07s). Provider-reported output totals are 113,705 tokens across these calls,
not 113,705 words shown to the user. Request duration includes provider/transport
latency; it is not a pure inference measurement. Auxiliary approval/judge calls
are outside this 129-call count. The 43m45s also includes tools, approval-path
waiting and the retry dispatch gap. QA began after the Mac woke: the earlier
10m48s system sleep and earlier user approvals do not explain this QA duration.

### Findings: confirmed causes versus unresolved attribution

1. **The QA split dropped useful execution guidance.** Commit `b0c0710cd9`
   introduced `guidance_profile = None if unit.get("skills") else build_profile`
   in `project_runs.py` (`_work_unit_body`). This avoids conflicting legacy
   completion/scope instructions, but also removes the Personal block's explicit
   instruction to check for an installed browser runner and avoid a model turn
   per keystroke. Both saved attempt bodies lack that block. The queue test
   explicitly asserts its absence. The focused skills still recommend batching
   and avoiding duplicated numeric tests, so this is not an absence of all
   guidance and does not prove the omission alone caused every extra call.
   Nevertheless the integration lost a useful behaviour guarantee.
2. **Automation was discovered far too late.** The worker first checked the
   already-installed Playwright/Chromium at 15:46:15, about 35 minutes after QA
   started. It wrote a browser script at 15:48:32 and ran it at 15:48:35.
   That suite initially passed 36/38 assertions; a missing reset between cases
   was corrected in the test harness, after which 38/38 passed at 15:50:42.
   QA did not repair application source. This supports choosing the executable
   test method at startup, not after spending the call budget on manual actions.
3. **Browser expiry interrupts active model work.** `browser_tool.py` applies
   120-second inactivity to both Python cleanup and its browser daemon. Neither
   of these checks treats an in-flight owning model turn as browser use. After
   a browser action at 15:22:06, a model request lasted 135.6s. Connection errors
   began at 15:24:04; Python logged cleanup at 15:24:19 (135s inactive). The next
   click used an invalid old reference; subsequent inspection found `about:blank`,
   requiring navigation and repeated work. The precise first killer between
   daemon expiry and Python cleanup is not isolated, but both conflicting
   lifetime mechanisms exist. Merely increasing one timeout is incomplete.
4. **Some repetitions were QA action errors, not app defects.** For example,
   the trace's attempted `12 + 3.5` clicked the `3` reference after the decimal,
   giving 15.3; corrected clicks produced 15.5. Other arithmetic sequences also
   used the wrong numeric reference. Separately, one correctly requested key
   sequence produced unexpected UI input; its root cause is not established.
   Do not claim all failures were daemon flakiness or an application defect.
   Browser tool batches run sequentially through the dispatcher, so the mere
   presence of multiple calls in one response is not proof of a concurrency bug.
5. **A security-approval path consumed 318.69 seconds.** A compound command
   preparing a deliberately failing copied test entered approval around 15:13:41
   and returned a denial at 15:19:00. The CLI approval callback's 300-second
   timeout returns the same denial outcome used for a human rejection. This is
   consistent with a headless approval timeout, but the current evidence does
   not establish that a human clicked Deny or conclusively identify routing.
   Reproduce that path before changing it; retain fail-closed security.
6. **Requirements producer and acceptance reader disagree.** `_criteria` in
   `qa_acceptance.py` only recognises ID/requirement Markdown tables. Lyra's
   requirements skill produced bullet declarations with FR, AC and NFR IDs.
   Applying the real parser to this approved file returns `[]`; table-only
   fixtures missed the incompatibility. The empty pin produced a genuine
   `needs-review` result. This is a deterministic integration defect, not
   evidence that Kanban cannot run small projects.
7. **The final assurance exceeds the recorded evidence.** The worker correctly
   records unmeasured contrast as BLOCKED and coverage as needs-review, yet
   Bano's final message says every rule passed and nothing remains unverified.
   Bano subsequently wrote `qa-acceptance-resolution.md`, accepting the empty
   mapping and claiming calculated colour ratios. Its post-QA tool trace does
   not contain an executed contrast calculation or rendered-style measurement;
   it is a prose assertion, not independently demonstrated closure. The
   original structured report still says needs-review. Chrome assertions also
   do not by themselves establish every browser/nonfunctional requirement.
   A scoped Functional pass is useful, but not universal acceptance or stable
   Lyra sign-off. The claim that everything was committed is also too broad:
   project Git status still has modified Brain and untracked requirements,
   previews, status snapshot and the resolution note (some predate QA).
8. **Some shell wrappers still obscure test failure, but the existing guard
   has NOT regressed.** Failed 36/38 runs used `python3 /tmp/qa_browser.py; echo
   "BROWSER_JOURNEY_EXIT=$?"`: terminal exit 0 while output printed exit 1.
   The shared skill already forbids this. Crucially,
   `agent/verification_evidence.py` classifies recognised zero-exit compound
   verification commands as `unverified`, not `passed`. Do not introduce a
   duplicate classifier or describe this as the old false-pass bug returning.
   Ensure final reports consume that uncertainty and use direct test commands.
   The later 38/38 output exists; earlier failed harness runs are not evidence
   that the final passing output was invented.

### Narrow repair order and impact checks (proposal, not implemented)

1. **Preserve efficient QA execution across the split.** Separate reusable
   execution-method instructions from phase scope and final-completion rules.
   Keep the existing Functional/Experience selection. At startup, choose the
   existing test runner; if absent, check installed automation once and save a
   small project-local browser smoke script. Use native tools when no runner
   is available. Retain all explicit approved criteria; do not reduce coverage
   to meet a call count. Test the actual queued body plus fully loaded skills
   for Personal, two-scope profiles and legacy jobs. Do not paste the whole
   old Personal block back into an Experience or non-final job. Existing saved
   job bodies and conversation prefixes must remain unchanged.
2. **Make coverage and completion agree.** Accept the requirements formats
   Lyra actually produces, with anchored declarations rather than every ID
   mention, clear FR/AC relationships and explicit NFR coverage. Test real
   skill-shaped documents, tables, duplicate IDs, references and ambiguity.
   Surface an unmappable contract before lengthy QA; never silently accept an
   empty list. Reuse structured acceptance status in the completion UI and
   coordinator instructions. A prose resolution must not override an open
   required check. Recheck only the missing criteria, preserving valid prior
   evidence; allow a real user waiver, not a model-invented one. Ensure the
   existing unverified shell evidence cannot become an unconditional final PASS.
3. **Repair browser lifetime ownership, not its arbitrary timeout alone.**
   Coordinate Python cleanup and daemon expiry with the owning active turn,
   using existing lifecycle/cancellation mechanisms where possible. Bound
   provider waits; keep cleanup for genuinely abandoned/crashed owners. Test
   a model delay over 120s, idle expiry, cancellation, worker exit and two
   isolated projects. Do not use perpetual heartbeats to keep stuck jobs alive.
4. **Reproduce the headless approval path, then repair only the confirmed
   gap.** Reuse the existing request-ID approval and user-input handoff rather
   than a new approval service. Distinguish denial from timeout/unavailable
   input; never auto-approve flagged commands. Test approve/deny/no responder,
   cancellation, delivery to the correct project and bounded timeout.
5. **Close the separate Mac sleep ownership gap.** Existing worker-only
   protection ended before a coordinator provider call. Cover genuinely
   active Studio coordinator work as well as workers using the existing
   platform mechanism. Allow display sleep and release protection when truly
   idle, waiting for user input, cancelled or failed. Do not claim this solves
   lid closure/forced sleep, and do not keep the machine awake indefinitely.

Other retained observations: startup briefly showed ready/zero tokens despite
an accepted in-flight first request; that needs session-event replay diagnosis,
not resubmission or a guessed model fix. The initial requirements contained a
wrong arithmetic result and an invented approval claim; normal user review
corrected both before Development. These remain recorded, not erased by QA.

For implementation: one focused change record and local commit per repair,
small cohesive new modules under 400 lines, real-path regression tests before
release, no unrelated core refactor or new scheduler. Keep generated app files
out of Lyra commits. After deterministic regressions pass, repeat a clean small
project twice with the same model/profile and independent browser acceptance.
Suggested performance targets for agreement: QA under 40 main-model calls and
10 active minutes per calculator-sized run, with zero budget restart; report
approval waits, provider time and sleep separately. These are validation
targets, not new hard caps or guaranteed model latency. Failure must remain
visible even if the app's functional tests pass.

**Current conclusion:** application unit tests were independently rerun (27
passed); QA reports 38 passing browser assertions after harness recovery.
Functional completion is supported within that scope, but the long QA path,
acceptance/reporting mismatch and uncovered runtime gaps prevent an honest
blanket “everything is fixed / stable” claim. No evidence here justifies
removing Hermes Kanban, adding a swarm, another QA split or a larger call limit.
