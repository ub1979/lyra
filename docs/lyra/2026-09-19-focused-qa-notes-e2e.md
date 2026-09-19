# Focused QA: tiny notes journey — 2026-09-19

## Frozen candidate and preflight

Candidate `6c434c77a`, Lyra 0.19.64 beta. QA implementation `b0c0710cd`.
User requested GitHub publication and then a small live project. Publication
was blocked by the approval check because all 43 pending commits would go to
`ub1979/lyra` main; explicit confirmation of that full payload was requested.
No push succeeded. Testing the committed local candidate is independently
authorized. No product source changes during this journey.

Clean checkout `/private/tmp/lyra-release-01964`: 281 Python tests passed;
491 web tests passed; typecheck passed; lint 0 errors / 30 existing warnings.
Two isolated browser smokes passed in 35.3s, covering normal conversation,
single new-project submission, reload and backend-restart durability. These use
an echo provider, not a real generated application. Existing local dependencies
are reused; this is not a fresh dependency-install validation.

Live dashboard: fresh process on localhost:9125; older localhost:9121 left
untouched. Existing runner had no active/ready jobs and was healthy before
its authorized restart. Recheck runner health before project submission.
Model: `glm-5.3-flash:cloud`, provider `ollama-local`, endpoint localhost:11434/v1.
The endpoint is local; inference still uses the cloud.
Controller evidence: `/private/tmp/lyra-notes-e2e-20260919-nnB0DJ/ui-events.jsonl`.

## Acceptance and method

Create a unique project through Studio New Project, Fast first version,
Personal profile. Tiny local notes app: create, select, edit and delete notes;
reject empty/whitespace-only content; retain notes across browser reload;
labelled keyboard-usable controls, useful empty/error states, and narrow layout.
No accounts, network storage, backend or deployment. Smart defaults permitted;
inspect and approve requirements and preview through Studio. Run the generated
test command unpiped and verify the real app independently. Lyra alone writes
or repairs the generated application.

Record submission, first useful response, approvals, Development, selected QA
skills, Documentation and final delivery. Separate model/work time from user
wait and controller mistakes. Check a read-only chat question during background
work, browser reconnect without duplicate jobs, and persisted final response.
One success does not establish overall Lyra reliability or a speed benchmark.

## Observations

- Runner restart completed; healthy dispatch tick confirmed before submission.
  Gateway PID 87491, test dashboard PID 87495. No active jobs were interrupted.
- 11:03:11 UTC: clicked Enter project studio once. Paste at 11:03:13.446 and
  Enter at 11:03:13.808 were on the same socket; no forced/manual resubmission.
- Project `my_projects/Tiny Notes QA 20260919`; coordinator
  `20260919_120313_20846e`. Initial reply visible by 11:03:33 (about 20 seconds
  after submission), asking a style preference and acknowledging the selected
  team. Studio showed Lyra ready and 23K usage, not a stuck working state.
- Answered through the visible composer: clean minimal defaults, selected team
  approved, short requirements and preview approval before Development.
- Initial provider call: 14.8s, 20,049 input / 2,952 output tokens; completed
  normally. On the next turn the progress text "Requirements agent is on it"
  was visible while Studio correctly showed Lyra working.
- Requirements ready around 11:04:49; inspected `requirements.md` directly.
  It retains the requested scope, explicit Save, delete confirmation, storage
  errors and reload behavior. Approved via Studio at 11:05:06. No Development
  task existed before requirements approval. Preview is the next checkpoint.
- Preview ready by 11:05:28; no jobs existed at 11:05:50 while it awaited the
  user. Inspected its actual HTML at desktop and 375px; no narrow overflow.
  Approved the exact "Minimal clean" option via Studio at 11:06:09.
  Minor copy observation: the question names `.sdlc/preview/index.html`, while
  the explicit design option correctly names the existing
  `.sdlc/preview/tiny-notes-minimal.html`. Only the latter exists.
- Development task `t_9304fb1c`, run 340, began automatically at 11:06:13;
  worker `20260919_120614_d59ff8`. No manual dispatch or duplicate job.
- Reloaded Studio at 11:06:46. Same coordinator and Development task recovered;
  no new submission from reload. At 11:07:07 sent a read-only status question.
  Useful answer visible by 11:07:28 while the same worker continued. Coordinator
  usage (423K) and worker usage (129K / 4 calls) appeared separately; these are
  cumulative usage, not unique context sizes or uncached billing.
- Exact read-only status response completed at 11:07:16: about nine seconds
  after submit. Development source (`js/storage.js`) and its executable tests
  existed by 11:08:28, within three minutes of worker start. Worker had reached
  25 model calls by 11:09:07; progress is real, but the final call target and
  completion are still unproven.
- Performance observation: repeated `hermes.lint.lsp` "fresh diagnostics timed
  out" warnings for JavaScript files, with corresponding `write_file` calls
  taking about 5.2–5.4s. At least six occurred by 11:09:13. This is measurable
  diagnostic-wait overhead, not proof of a stalled worker; its underlying cause
  has not been diagnosed. No diagnostic config or product code was changed.
- Development exceeded the 60-call performance target before completion.
  A genuine native delete confirmation blocked its default browser tool path:
  click, console evaluation and Enter each timed out (30s); navigation then
  timed out (60s). This consumed at least 150s in serial waits. The existing
  `browser_dialog` tool is explicitly CDP-only (`tools/browser_dialog_tool.py`);
  this configured default backend has no CDP endpoint and its availability
  check returns false. The worker did not have that recovery tool. A native
  confirmation is valid app behavior; the tooling gap is separate from it.
- 11:16:11 preliminary independent app acceptance: 10 groups passed, 1 failed.
  CRUD, cancel/confirm delete, keyboard activation, reload persistence, 320px,
  literal-text safety, corrupt saved JSON and write-quota failure passed.
  A throwing `window.localStorage` getter caused an uncaught SecurityError;
  the controller accesses it outside the storage adapter's catch. This is an
  app error-handling defect, not a Studio submission error. Development/QA
  have not completed, so it is not yet a missed final QA finding. No app edits
  or result feedback have been supplied by the supervisor at this checkpoint.
  Evidence: `preliminary-before-qa.json` beside the controller log.
- Independent direct `npm test`: 50/50 passed, exit 0. Unit success did not
  cover the throwing browser-storage getter. This was a preliminary run while
  Development remained active, not final acceptance.

### Clean-journey failure and explicitly assisted continuation

By 11:17 the worker had repeated timeouts on the same blocked browser, rather
than completing or clearly reporting the blocker. The unassisted clean journey
is therefore not a pass. No timing or reliability claim should erase that.
Sent a normal Studio recovery request after preserving the failure: inspect
and recover the existing work, retain code/evidence, do not modify Lyra or
install packages, continue Personal Functional QA and Documentation. Also
supplied the independently reproduced blocked-storage-getter defect for QA.
This is supervisor feedback, not an independently discovered QA finding.
The supervisor still makes no generated application edits. Further results
are an assisted continuation on the same frozen Lyra candidate.

- Recovery request sent 11:17:57. The old worker had already begun replacing
  native confirmation with an in-page dialog before the coordinator acted;
  its browser remained unhealthy afterward. Do not attribute all of that
  workaround to the supervisor's request.
- Coordinator stopped/archived task `t_9304fb1c` at 11:18:46 (run 340 reclaimed,
  83 calls, 12m33 elapsed). Files and evidence remained. This was an explicit
  user-requested recovery, not automatic call-limit retry.
- Continuation task `t_e3f433f9`, run 341, started 11:18:49; worker
  `20260919_121850_dd1df2`. Functional QA task `t_7760c48d` and Documentation
  `t_9d4affd7` wait behind it. QA's persisted skill list is exactly
  `ultimate-builder:qa-evidence` + `ultimate-builder:qa-functional`, one
  `QA-PERSONAL-FUNCTIONAL-001` unit, not the old broad QA skill or four stages.
  The coordinator recorded the defect and continuation instructions; it did
  not patch the app itself. Studio returned to ready with the worker visible.
- Process check confirmed old worker PID 93805 exited; only continuation PID
  11750 remained. No overlapping developer processes were left behind.
- 11:22:41 independent rerun after Lyra's repair: all 11 acceptance groups
  passed, exit 0, including the previously failing denied-storage getter. Test
  deletion selectors were updated for the actual new in-page confirmation;
  the required cancel/confirm behavior was not weakened. App screenshots were
  saved at desktop and 320px. This is app behavior evidence; Development and
  the new QA phase still need to complete their own handoff.
- Continuation completed via `kanban_complete` at 11:23:56, 33 calls / 5m07.
  App commit `996510a`. Its evidence records 54 unit tests and 40 browser
  checks, exit 0; the loop immediately ended with `kanban_terminal`, not a
  further coding turn. Supervisor browser results independently corroborate
  the repaired acceptance paths, but do not replace QA's own evidence.
- Functional QA picked up automatically at about 11:24:49 (53s after the
  preceding completion), worker `20260919_122450_a9159a`. No manual scheduler
  action. Studio showed the specific Functional QA item and separate live
  usage; Documentation remained queued behind it. Runner health stayed running.
- QA completed 11:29:00: 61 model calls / about 4m11, no retry. It directly ran
  `npm test` (54/54) and `node scripts/dev-smoke.cjs` (40/40), both exit 0,
  then performed native browser journeys. Evidence and report committed as
  `1a817de`. One Functional item correctly finished the overall QA phase;
  Documentation started automatically at 11:29:49, worker
  `20260919_122950_f25fdd`. No fourth-stage dependency deadlock or duplicate QA.
- QA report caveat: it says "all approved criteria verified" but marks approved
  NFR-004 contrast untested because Experience was not selected. A reduced
  profile must not silently waive an explicitly approved requirement; this
  wording/coverage inconsistency remains a QA-contract finding. It correctly
  disclaims real screen-reader testing and production sign-off.
- Supervisor independent contrast check: rendered body/editor/button/footer
  colors agree with the CSS palette. Body text 16.65:1, editor/labels 17.40:1,
  muted footer 6.40:1, muted white-card text 6.69:1, primary button 7.36:1;
  CSS error text 7.61:1 and warning text 6.97:1. All these normal-size text
  pairs exceed 4.5:1. This is a proportional text-contrast check, not full WCAG
  certification; it does not make the QA worker's omitted check retrospectively
  performed. Screenshots show no clipping at the tested desktop/320px sizes.
- QA elapsed time is shorter than the earlier calculator's 11m12 and warm
  retest's 15m27, but this is a different app and provider latency varies.
  61 calls are fewer than the 90-call baseline and more than the 36-call warm
  retest. Do not claim the skill split alone caused the speed difference.
- Documentation completed 11:31:55, 17 calls / 2m06, app commit `01ee0d3`.
  Final coordinator delivery at 11:32:22. Studio displayed Lyra ready, three
  phases done, zero open, no active workers. Direct `file://` create/save/reload
  also passed with no page error; HTTP acceptance had already passed.
- Whole journey: initial submission 11:03:13 to final delivery 11:32:22,
  about 29m09 including short approval waits, the failed attempt and assisted
  recovery. This is not "fast autonomous completion" of a tiny notes app.
- Final reply durably saved as message 47356 (1,700 characters), hash
  `af818cdd44231cf1e2f045fb26d06c0d0c62b8c1587c7ee785f1046dda1e02de`.
  Stopped only idle test dashboard PID 87495; verified its TUI child exited.
  Original dashboard and gateway untouched. Restarted test dashboard on the
  same port and resumed the same session through its normal URL. Saved reply
  hash and message counts remained identical (33 assistant, 33 tool, 7 user);
  final text returned, with no duplicate prompt or job on reopen.
- Ready composer restored after startup. A normal read-only follow-up at
  11:35:43 received a useful answer confirming completion and no active jobs;
  no new job was launched. Final reply persistence and ability to chat pass.
- Confirmed cold-restart accounting seam: coordinator UI fell from ~1.19M to
  **0**, then showed **96.0K** after the follow-up (only the new process's usage).
  Saved DB totals remain cumulative: 35 calls, 328,218 input, 31,376 output,
  927,360 cache-read after that turn. This is not lost conversation or lost
  persisted usage. Source chain: `agent/agent_init.py` initializes cumulative
  in-memory session counters to zero; `tui_gateway/server.py:_get_usage` reads
  those counters; `_session_usage_snapshot` prefers a live agent over retained
  metadata. The backend emits real numeric zeroes, so a browser cache alone
  does not solve cold restart. Need an explicit persisted-session versus
  current-runtime usage contract and a real restart regression, without
  double-counting DB deltas or combining coordinator and workers.

## Result and next actions

**Application acceptance: pass after assisted recovery. Clean autonomous Lyra
journey: not passed. New Personal Functional QA selection/completion: passed.**

The first failure occurred in Development before the new QA skill ever ran.
It is not evidence that splitting QA broke project startup or the app. The
default-browser/CDP restriction is existing infrastructure; avoid replacing it
with a second browser stack or solving it by weakening delete confirmation.

| Finding | Action justified by this run | Regression needed |
|---|---|---|
| Native dialog leaves default browser commands timing out repeatedly | Extend the existing browser/dialog recovery path for supported local backends; surface the actual blocking dialog instead of suggesting a missing browser install | Real default-backend confirm: accept/cancel, subsequent click/navigation, bounded failure; retain CDP backend behavior |
| Cold resume shows 0 and then only post-restart coordinator usage | Reconcile persisted session usage with runtime counters without double-counting; retain separate worker totals | Existing backend-restart Studio smoke must assert usage as well as reply durability, plus a follow-up turn and new-session isolation |
| QA calls all approved criteria verified while excluding approved NFR-004 | Make approved criteria take precedence over default QA breadth; evidence omissions must qualify the verdict | Personal QA with an explicit contrast requirement and an explicitly untested criterion |
| Repeated 5–10s editor-diagnostic waits | Diagnose the actual LSP timeout/availability boundary before proposing a fix | Existing working and unavailable language-server paths; do not silently remove useful diagnostics |
| Preview question names a nonexistent default index | Derive question copy from the actual registered preview option | Single custom preview path and multiple options |

Additional limitation: README's Node ≥18 floor was not tested on Node18; the
local installed Node runtime was used. Its `npm start` also relies on Python3.
Direct file opening works on the tested Chromium runtime. No Safari, actual
screen-reader, Production profile or Experience-stage live journey was run.
Existing unit/integration checks cover the other QA profiles; that is not the
same as live acceptance of those paths. The earlier macOS app-modification
permission warning is not resolved by this trial and no permission was changed.

No generated app source, tests or reports were hand-written by the supervisor.
Only external acceptance probes and this Lyra report were authored here.
No product fix was applied mid-trial. The GitHub push remains blocked pending
explicit approval for the full pending commit set/destination; local commits
and trial evidence are retained. One recovered app does not establish overall
Lyra stability, and the next action should address the reproduced boundaries,
not add features or raise model-call limits.

### Test cleanup

After confirming all trial tasks were done or archived with no worker PID,
closed the supervisor browser and stopped only its test dashboard on port 9125
and app HTTP server on port 9135. The normal dashboard on port 9121 and managed
gateway remain running. Project files, saved conversation, task evidence and
the external acceptance artifacts are retained. No project was deleted.
