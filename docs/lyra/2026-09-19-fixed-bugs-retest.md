# Fixed-bug retest — 2026-09-19

## Frozen scope

Candidate `9adedac6a` (startup `864a03b59`, Personal QA `8cc6c8144`).
No product changes during this retest. Dashboard localhost:9121, real model
`glm-5.3-flash:cloud` through `ollama-local` (cloud inference).
Follow `STUDIO_TEST_GUIDE.md`. Preserve unrelated untracked files and old evidence.

## Startup and runner preflight

- Runner health reported `running` with a successful dispatch pass before the test.
- Existing calculator coordinator `20260919_051721_c9f347` was ready, no active jobs.
- Browser reloaded at 08:28:18 UTC to load the corrected bundle; final calculator
  history was available before the new QA request. No second coordinator launched.
- Isolated real-dashboard/Ink/mock-provider New Project test repeated twice:
  2 passed, 10.6s and 11.6s. Includes exactly one initial submission, reload with
  no resubmission, and follow-up reply. No live model inference in these two tests.
- Live GLM startup probe submitted once at 08:29:19 UTC through New Project:
  `Startup Fixed Retest 20260919`. Acknowledgement only, no app build or jobs.
  Passed: paste at 08:29:20.845, Enter at 08:29:21.165; one acknowledged reply.
  Session `20260919_092921_7cce61` persisted one user message (one setup marker,
  one brief) and one assistant reply. Reload at 08:30:11 preserved the reply,
  sent no additional paste/Enter. A normal follow-up sent at 08:30:58 received
  a context-aware response; no background jobs or application work started.

## Fresh Personal QA comparison

Same completed calculator, requirements and approved design. Prior baseline:
run 337, 90 model calls / 11m12, including discovery and repair of border contrast.
This rerun uses the repaired artifact and previous evidence, so it is a warm
retest, not a controlled fresh-project speed benchmark.

- 08:28:39 UTC: user request through visible Studio composer for fresh QA only,
  preserving prior evidence, no Requirements/Development/Documentation restart.
- 08:28:54 UTC: new task `t_bf0940ef`, run 339 started automatically.
- Worker session `20260919_092855_39ea35`, PID 7637; saved job body confirmed to
  include `Personal QA execution contract` from the new guidance.
- No CLI/manual job dispatch and no runner restart.
- QA initially probes installed Playwright runtimes: one installation lacks its
  matching browser; another cached runtime launches. This is setup overhead,
  not an app failure. No new app-modification TCC events in the first checked
  six-minute window, and no permissions changed.
- At approximately five minutes, only 11 model calls but no completed browser
  pass yet. Several responses took 44–54s, while file/tool reads were short.
  Reduced calls alone must not be called improved end-to-end latency.
- A read-only status question at 08:33:06 received a useful reply while QA
  remained the sole active job. Supervisor independently reran 40/40 tests
  (exit 0), decimals/negative browser cases and 320px no-overflow checks.
- Outcome, actual coverage, calls and time: pending.
- Final outcome: completed, no retry or error. Run 339 ended at 08:44:21 UTC,
  927 seconds (15m27) after start, at 36 model calls. Compared with the prior
  90 calls / 11m12: 60% fewer calls but 4m15 longer elapsed work. This warm rerun
  does not establish a latency improvement; startup/dispatch pass independently.

### Observed QA overhead and harness errors

Call 12 took 175.2s (15,674 reported output tokens) before the reusable browser
script appeared. At calls 13–16 it began executing and repairing that script.
The first substantial run failed on harness defects: wrong expected 1/7 value
(app returned the correct 0.1428571429), stale operation/large-number expectation,
wrong Tab sequence, and a contrast helper accepting rgb strings but given hex.
These are generated-test defects, not evidence the calculator regressed.
The run also used `...; echo SMOKE_EXIT=$?`, making the enclosing shell exit 0
despite SMOKE_EXIT=1. Preserve raw output; never accept that shell status as PASS.
No final verdict accepted while this remains unresolved. No supervisor app edits.

By 08:41:10 the repaired smoke produced `RESULT pass=88 fail=0`, including real
keyboard/error/reset/reload, rendered contrast, 320px and console checks.
Supervisor inspected the screenshot; no clipping/overflow and readable controls.
The raw saved evidence supports those results. The enclosing commands still use
`echo SMOKE_EXIT=$code` rather than returning `$code`, and other helpers still use
`| tail ...; echo ...`. Thus the no-masked-exit instruction is not reliably obeyed;
this retest does not establish that evidence-classification risk as resolved.
QA elapsed work already exceeded the 11m12 baseline before final reporting.

## User stop request and final state

User asked to stop QA and summarize. The immediate UI/DB check found the task
already completed, worker_pid null, and Studio showing Lyra ready / no active
work. No cancellation or new QA run was needed or issued. No code was changed.
The coordinator's final report claims 88 passing checks. Its wording overstates
screen-reader evidence: DOM live-region attributes were checked, not an actual
VoiceOver/NVDA announcement. Retain the narrower evidence claim.

Retest verdict: initial submission and reload fixed; runner preflight/automatic
dispatch passed; calculator checks pass. QA call overhead decreased, but total
QA speed did not improve, generated harness errors cost time, and shell exit
masking plus overbroad final wording remain observations for follow-up. No claim
that all Lyra reliability/performance problems are solved. Mac permission cause
remains unresolved. Nothing pushed or restarted.

Mac permissions remain unchanged. A prior app-modification denial is not counted
as resolved without identifying/retesting its exact operation.
