# Lyra: big-picture diagnosis and proposed next actions

Date: 2026-09-19. **Analysis only; no product changes or release approval.**
Candidate examined: `9e0ae49ea` (local version label 0.19.63).
This follow-up does not erase revision 6 or mark its acceptance gates complete.

Implementation follow-up: [steps 1–4 repair record](changes/2026-09-19-workflow-contract-repairs.md).
The user approved implementation and reserved step 5 for their own testing;
the analysis below is retained as the rationale, not a claim of live acceptance.

## Original goal — keep this fixed

A lightweight, usable interface over Hermes and the user's specialist skills.
The coordinator talks to the user; specialists receive the relevant approved
requirements and artifacts, build the application, verify it and return results.
The user chooses the project scale and team. Preserve Hermes memory, learning,
complete skill loading, prompt caching and durable background work.

Do not turn the next repair into a workflow redesign, remove useful safety
checks, fix the generated application by hand, or raise budgets to hide waste.

## Evidence and limits

- [Historical/current comparison](2026-09-18-end-to-end-comparison-report.md).
- [Revision 3](2026-09-18-reliability-and-workflow-plan-v3.md) and
  [revision 6](2026-09-18-bounded-project-execution-plan-v6.md).
- [Verification follow-up and corrected storage diagnosis](changes/2026-09-18-revision6-verification-followup.md).
- [Frozen calculator trial, timings and source-backed findings](2026-09-19-calculator-live-trial.md).

Reviewed the relevant Git change families and current integration points, not
every line of every historical release. The old comparison has overlapping
coordinators and different initial milestones; it cannot establish that removing
Kanban restores speed. The calculator is one small successful functional journey,
not proof of enterprise behavior, every provider or recovery under failures.

## What the modifications accomplished — and where they do not join up

| Change family | Intended benefit | Evidence / remaining mismatch |
|---|---|---|
| Recoverable project jobs, `eed817222` | Work survives the browser | Calculator's three jobs ran automatically, finished with zero retries and cleared PIDs; crash recovery is a separate gate |
| Notification claims and worker usage, `895e70e5d`, `23f15028a` | Avoid false busy state; show worker work | Completion notifications arrived promptly; coordinator status/unknown usage still needs work |
| Bounded `project_run` and no-shell coordinator, `6d12d5ab7`, `efc5f026c`, `abab45a83` | Keep chat responsive instead of doing workers' work | Older generic verify-on-stop still orders this coordinator to execute checks |
| Context/skill corrections, `fe183b24b`, `1e44460c6` | Estimate sent context; preserve complete instructions | No compression observed in calculator; separately, installed skill helpers are missing |
| Interim messages and Personal QA, `cd5a5e742`, `fa04e4709` | Show progress; make small projects proportional | Interim appeared and one real QA stage completed; Documentation still follows its full-suite procedure |
| Trusted preview gate, `43802f530`, `8c31bd8a6` | Prevent building without user consent | Gate refused unauthorized queue correctly; setup instructions caused duplicate approval and omitted selected-design handoff |
| Ledger/test guidance and attempt ceilings, `b975f1674`, `359597f6f`, `a80fea6e8` | Reduce discovery waste; bound whole attempts | Development finished in 44/90 calls; plain Node test results did not enter the authoritative evidence store |
| Runner health and persistence checks, `ddb79c319`, `7466b0ef9`, `9e0ae49ea` | Detect runner outages; prove replies survive restart | Dispatch and final save passed here; prior SQLite I/O incident remains unexplained and managed-service recovery is unverified |

This is progress, but not a clean reliability sign-off. A patch can solve its
local problem while leaving callers, prompts, installed assets or downstream
consumers following the old contract.

## Main diagnosis

**The best-supported common cause is inconsistent integration contracts.**
The model is repeatedly left to reconcile instructions and state which the
software should already have made consistent. This adds model calls, searches,
workarounds and misleading status. There are also ordinary underlying bugs;
not every observed problem was introduced by the recent changes.

Concrete examples from the frozen trial:

1. Setup asks for plain preview approval; the queue requires a special backend
   checkpoint. One real approval is collected but unusable, so the user is asked
   again. Preserve the gate; make the presentation follow it.
2. The coordinator edits preview HTML but has no terminal. Generic verification
   demands execution anyway. It tried to finish after dispatch, then spent
   **29 additional calls / about 5m20s** on workarounds. Development was running
   simultaneously: these minutes are not an additional serial delay.
3. Approval stores status/time, not the selected design. The worker searches
   conversation history to discover Look A; the Brain is stale. This contributes
   to overhead, but does not explain all model generation time.
4. QA's skill refers to sibling helpers that exist in source but are absent in
   the installed home. The sync boundary copies only individual skill subtrees.
5. Personal reaches Development and QA, but not the Technical Writer's outcome
   instructions: **47 calls, 8m21s, 891 lines** for requested short instructions.
6. A successful one-shot cron run removes its schedule entry. The tool reads that
   missing entry for its outcome and incorrectly reports failure.
7. Test instructions recommend Node's built-in runner, but command discovery
   misses this manifest-free app. Its evidence DB is empty. Actual tests passed
   independently; this is a coverage gap, not a demonstrated false-green record.

The calculator took **39m38s**, including about 1m45s approval waiting, and
**202 main model calls**: coordinator 70, Development 44, QA 41, Documentation 47.
Auxiliary judge/learning/title calls are outside that count. Two Development
responses took 156.5s and 145.5s and produced large outputs: real completed model
work, not proof of a dead process. The first source file arrived after 7m24s.

The same LLM can become slower when asked to do more or reconcile contradictions.
This trial does not establish a new provider fault. Memory cannot repair missing
approval authority, unusable tools or missing installed files. Use durable project
artifacts for handoffs and Hermes memory for learning; do not copy the whole chat
or treat remembered consent as a current approval. Preserve stable cached prefixes.

## Why the previous verification did not settle this

Many checks covered one component rather than the real boundary between them:
checkpoint tests did not run the generated setup instructions; profile tests did
not cover Documentation; cron tests assumed a surviving schedule record; evidence
classification tests did not prove this project's command was discovered. Testing
source skills is not the same as testing skills installed in a fresh home.

Earlier trial interpretation also needed correction: untouched persistence files
cannot prove an indirect regression impossible, and a harness waiting for the
wrong question type cannot prove the assistant stalled. Keep these corrections.

## Proposed repair sequence

Before each implementation: reproduce against frozen HEAD, inspect affected
instructions/tests, document callers and consumers, add a failing behavioral
regression, then make the smallest fix. No unrelated refactor or new framework.

### 1. Make coordinator responsibilities executable with its actual capabilities

Align preview verification, finish/handoff behavior and tool availability.
Use the existing verifier with a capability-appropriate policy; do not globally
exempt HTML or disable worker verification. Resolve the verifier's prescribed
temporary path versus file-tool policy without broadly weakening path protection.
Decide whether immediate cron execution belongs to this coordinator at all;
removing terminal alone is not a security sandbox or complete role boundary.

Affected: agent verification/turn completion, Studio construction policy,
preview instructions. Keep generic core behavior generic: no builder-specific
special case in core. No mid-conversation toolset or prompt mutation.

Regression: real restricted coordinator creates a preview, records appropriate
verification and hands off without shell/cron workarounds. Normal CLI/developer
code changes must still require real evidence. Post-dispatch coordinator does
not edit artifacts owned by its active worker. Preserve user chat during work.

### 2. Join preview consent and the worker handoff

Align every generated setup path with the existing backend-owned checkpoint.
Preserve the authenticated user's selected preview/artifact with that decision,
and include it in the existing job instructions. A mutable Brain may summarize
the decision, but is not the source of approval authority.

Affected: builder setup source/generated asset, preview checkpoint storage and
answer hook, task-body construction, typed/button clarification paths.
Define old-record behavior: never guess a missing choice when several previews
exist; ask a focused question only when the choice is genuinely unknown.

Regression: two previews, user selects A once, one authorized Development job
receives A without searching chat. Also cover typed approval, Skip, Change,
stale digest, wrong session, duplicate input, reconnect and old projects.

### 3. Complete the existing Personal and skill-install contracts

Two independently testable fixes, not a new settings system:

- Personal Documentation: concise README covering run, test, limitations and
  necessary usage. No unsolicited deployment suite. Preserve whole skill
  loading, selected agents and richer profiles; verify relevant examples.
- Repair affected skill resource packaging using existing installation/sync.
  Validate referenced helpers in a fresh home and an update of an existing home;
  preserve user-modified skills. Do not recursively copy arbitrary parent trees.

Affected: builder per-phase guidance/skill instructions and bundled skill
resources/sync boundary. The earlier shared-standards fix is not proof that all
other sibling resources install correctly. Add a focused resource integrity check.

### 4. Make execution evidence and visible status truthful

Use separate focused fixes:

- Recognize the actual repeatable project test command through existing project
  facts/evidence machinery, including dependency-free Node tests. Test the real
  terminal-to-ledger path, not just the classifier. A model's report is not proof.
- Return one-shot cron outcome from authoritative execution evidence rather
  than schedule existence. Do not equate `processed` with success. Cover real
  successful/failed one-shots, recurring runs and duplicate claims in temp storage.
- Derive coordinator status from existing connection/turn state; unknown usage
  remains unknown, coordinator and worker totals remain separate. Judge/summary
  usage is still an accounting gap: disclose it until actually instrumented.

Negative control: a deliberately failing test, including a masked pipeline, must
never become a verified pass. A subsequent real direct pass must be recorded;
rejecting bad evidence alone is insufficient if good evidence is never collected.

### 5. Freeze the candidate and run acceptance, not another exploratory rewrite

First exercise deterministic cross-component regressions using real temporary
stores, freshly installed skills and a controlled provider. Then run at least
two identical small Personal journeys through Studio, same model/team/brief,
one coordinator each, with product code frozen. Do not repair the app manually.

| Check | Acceptance / measurement |
|---|---|
| User consent | One preview decision; no unauthorized queue; selection retained |
| Dispatch | Zero manual dispatch; no duplicate worker on reconnect |
| Development | First actual source within 3 minutes; under 60 calls target; retain 90-call safety ceiling |
| Functionality | Independently verify unchanged calculator criteria and direct tests |
| Test evidence | Real pass recorded; deliberate failure cannot be recorded as pass |
| Communication | Local receipt and interim-event rendering each within 1 second, instrumented rather than visually guessed |
| Foreground | No repeated verification detour after accepted handoff; measure status-response latency separately from provider wait |
| Documentation | Only approved Personal outputs; record calls/time versus 47 calls/8m21s baseline |
| Persistence | Completed reply survives reload and backend restart exactly once; composer usable |
| Total work | Report elapsed active time, user waiting, per-phase calls and provider latency separately |

Do not promise a fixed overall completion time before measuring the repairs.
Passing call ceilings is not a latency pass. If first-source latency still fails,
inspect the long Development requests and output sizes specifically; do not
relax the target silently or rewrite compression when no compression occurred.

Separate reliability gates remain: managed macOS runner crash/restart, worker
exhaustion and its single continuation, cancellation, provider timeout, and a
Production graph journey before any Production reliability claim. Diagnose the
old SQLite I/O incident if reproducible; a clean run does not establish its cause.

## Implementation discipline and stopping rule

- Focused modules, one responsibility, new files/classes under the requested
  400-line limit. Existing large core files get thin generic integration only;
  flag necessary exceptions rather than quietly expanding them.
- One independently reviewable fix per local commit, impact record and tests.
  No push/restart without the applicable authorization. Version once per
  authorized pushed change set; rebuild affected tracked generated assets.
- Keep older plans as evidence. Update their status links when implementation
  starts; do not count an old green test as proof of a newly affected path.
- Do not add swarms, a second dispatcher, a settings/locking framework, split
  this tiny app into many cards, raise global limits or truncate skills.
- If a new issue blocks the frozen acceptance, record its cause and stop that
  candidate's sign-off. Repair a bounded, reproduced defect; rerun the affected
  contracts and complete journey. Do not announce universal reliability.

**Current judgement:** capable of completing this small app, with meaningful
reliability improvements, but still too costly and inconsistent to call trusted
hands-off software. Repair the mismatched boundaries; retain the working base.
