# Tiny Counter — QA-only routing retest

## Frozen candidate and scope

User requested only QA. Candidate `1ca8a98bc`, including dependency validation
and QA role guards. Existing project: `my_projects/Tiny Counter E2E 20260919`.
No Requirements, Development, Documentation or new project is authorized.
Use the supported project-run CLI to queue one Personal Functional pass;
this tests the worker lifecycle, not Studio's submission/composer path.
Model `glm-5.3-flash:cloud`, provider `ollama-local`; cloud inference remains
network-dependent. No model or budget changes.

App baseline HEAD `e9fcc39c5930cb0c4cf2992f7b943d5b3c2498bb` already has dirty
`js/app.js`, `.sdlc/evidence/qa/pw-run.json` and `pw-shots/j6-strict-privacy.png`
from the prior interrupted run. Preserve them. Initial app.js SHA-256:
`f1a54fcc23e1b1533e9fb2c4e1b9ac755f67e1ff4906b5796de6fe16a236f396`.
QA may update testing/evidence only; failure must hand off and stop, not repair.

## Preflight

- No running or ready tasks before restart. Prior QA/repair tasks archived.
- Sandboxed status falsely returned an empty project because it could not read
  the live database. Authorized unsandboxed status correctly found three tasks.
  Use that access for observations; do not treat the empty result as product data.
- Gateway initially reported detached PID 53046; foreground replacement refused
  because launchd owned the service. Used supported `gateway restart`, which
  reported a zero-second drain warning then restarted under launchd (PID 89440).
  No active job was interrupted. Wait for a fresh successful dispatch heartbeat.
- Existing dashboard is not restarted; no claims about its loaded Python code.

## Acceptance

Record one QA task/attempt, skills, tools, actual result and elapsed time.
Verify no new repair/development tasks and no application-source modifications.
If blocked, observe subsequent dispatcher ticks without automatic QA restart.
If completed, inspect raw test output and reported coverage before accepting.
Raw CDP harnesses remain forbidden; Playwright/Hermes browser tools are allowed.
No product code changes during this frozen retest.

## Live observations

- Fresh successful gateway tick at 19:28:22 local. Queued only `qa-engineer`
  with Personal profile and force-new, retaining GLM/Ollama routing.
- Task `t_5d87ab07`, run 354, PID 90826, session
  `20260919_192853_c6ccde`; worker began around 19:28:53 local. Skills are
  `ultimate-builder:qa-evidence` and `ultimate-builder:qa-functional`.
- Added an operator comment reiterating QA-only scope, preservation of dirty
  app source, Playwright-only harness policy and report/block rather than repair.
  No coordinator notification subscription was created by this CLI run, so
  automatic coordinator continuation is outside the test's scope.
- Interrupted first attempt after its persisted todo proposed committing
  "repair + QA evidence", which would include the pre-existing dirty app file.
  This was a proposed action, not an observed source mutation. The operator
  restriction had arrived after its initial `kanban_show`, so this does not
  prove it ignored a received comment. Test setup correction: save authorization
  before dispatch. First attempt reached nine model calls, with two provider
  responses taking 90.6s and 112.9s. Stop archived only this QA task and confirmed
  worker termination with no unconfirmed PID. Source checksum remained identical.
- Replacement task `t_aa093e0e` was queued while the managed gateway was stopped.
  Explicit QA-only/no-source-edit-or-commit comment was persisted while ready,
  before any run existed, then the supported gateway start was used. This is an
  assisted retest, not a clean first-attempt completion. No product code changed.
- Replacement run 355, PID 3277, session `20260919_193630_0b2449`, started
  approximately 19:36:30 local. By 19:37:59 it had run the existing tests:
  unit output 40/40 pass; Python Playwright 59/59 pass, including the denied
  storage getter. The unit command initially appended `echo`, so Lyra correctly
  labelled machine verification evidence `unverified` despite the raw green
  output. Browser command explicitly propagated its exit code (0).
  These results validate the existing dirty app, not the committed app revision.
  Source SHA-256 remained identical to the preflight baseline.
- Replacement completed at 19:42:23 local: one run (355), 29/90 model calls,
  about 5m54s from DB start to completion. Loop stopped immediately with
  `kanban_terminal(kanban_complete)`; no repair/development job was created.
  CLI then entered the normal post-session learning step, distinct from another
  QA attempt. QA committed only evidence/reports/ledger (`594b7d1`, `70b9ec9`).
  `js/app.js` remained dirty and its SHA-256 stayed identical to preflight.
- The lifecycle success is **not full acceptance**: the original requirements
  explicitly require Chrome, Safari and Firefox. QA tested Chromium only and
  disclosed Safari/Firefox as inferred/untested, but marked QA verified because
  the pinned contract contains only six numbered FRs. That is an unresolved
  coverage/sign-off gap, not a reproduced retry-loop failure. No user waived
  those browser requirements. The correct independent verdict is Chromium
  functional checks passed; full stated browser coverage remains unverified.
- Since this run's functional tests passed, it did not exercise the live
  failing-QA `needs_input` handoff. That failure path remains covered by the
  prior real-database regression tests, not newly demonstrated by this run.
- Independently reran plain, unpiped `npm test` after QA: 40 passed, zero
  failed, actual exit 0. At 19:43:43 local (after two scheduled dispatcher ticks),
  run 355 remained the only replacement attempt; no running or ready tasks
  existed and PID 3277 had exited. No automatic QA restart or follow-up repair.

## Result and follow-up

QA-only execution and normal completion passed on the assisted replacement.
The first interrupted attempt remains part of the result, not discarded.
Browser coverage/sign-off remains incomplete: unnumbered nonfunctional
requirements are absent from the six-ID contract, and the worker treated
untested browser compatibility as a caveat instead of an acceptance blocker.
Record/review that separately before changing Lyra; no implementation changes
or new full-project run were made here. The current working tree, not the
committed app source alone, is what passed. Nothing pushed.

## Publication decision

After reviewing these results, the user explicitly waived further Safari/Firefox
testing and authorized publication of all 64 pending Lyra commits, plus the
required 0.19.65 beta version update. The untested browsers remain unverified;
the waiver does not turn missing evidence into a pass or change future projects'
QA rules. The historical observations above remain unchanged.
