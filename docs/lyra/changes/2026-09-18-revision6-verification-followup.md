# Revision 6 verification follow-up

Status: three bounded fixes implemented and focused verification completed;
local only, no release and no full-project acceptance claim.

## Problem and reproduced boundaries

- Attempt budgets sum `IterationBudget.used`, but successful `execute_code`
  iterations are refunded. Continuations can therefore exceed the advertised
  attempt-wide model-call allowance. Preserve refunds outside bounded workers.
- Preview approval hashes only the first 200 files and excludes symlinks.
  Unhashed content can change without invalidating approval. Fail closed with
  an actionable error for unsupported previews; never approve a partial hash.
- Dispatcher ticks precede dispatch. A failed pass can therefore advertise
  healthy work checking. Publish completed outcomes, report failed passes as
  unknown, and do not treat a fresh failed tick as a successful UI start.

## Acceptance, impact and recovery

Each defect gets a behavioral regression with the real relevant boundary
(agent loop, filesystem/approval store, dispatcher watcher). Existing legacy
behavior remains covered. No schema migrations, new scheduler, settings store,
prompt rewriting, or changes to the user's active dashboard. Tick records are
ephemeral; old records without outcome evidence must remain unknown until a
new gateway publishes a completed pass. Revert focused commits to roll back.
Gateway/worker fixes require a later agreed restart; no running jobs are stopped.

## Correction to Trial 4 diagnosis

Trial directory: `/private/tmp/lyra-trial4-20260918T231657`.
The 624-character reply **was visible in Studio** and asked whether tasks should
be editable. The harness only watched for typed clarification placeholders,
did not answer the ordinary chat question, and timed out after eight minutes.
Its `hasDevelopment` check also matched the sidebar label; it was not evidence
of a Development run. That harness passing did not mean the journey passed.

Moving the test home did **not** resolve storage errors: `/api/sessions` logged
SQLite disk-I/O errors repeatedly after the reply. An immutable read of the
remaining DB shows only the user row. Root cause and lost-write provenance are
not yet established. Neither unchanged persistence files nor an older
history-version defect establishes whether this failure is a regression.
Do not conflate visible response, in-memory resume, and durable database save.

## Verification

The existing isolated Studio echo-provider browser smoke passed before these
edits, including two replies and reload. It is not a real-model project test
or proof of persistence across backend process restart. Strengthen that proof
before drawing conclusions about the Trial 4 storage symptom.

The strengthened browser smoke passed (16.9s): two turns, SQLite reads from a
separate process, browser reload, and full dashboard/PTY restart. The new port
is a fresh browser origin. By existing design it restores the latest reply,
not all earlier chat bubbles; both replies remain in SQLite. Two exploratory
failures expected all bubbles on a fresh origin and were corrected to match
that existing contract, not by changing product recovery code.

Initial opt-in real-model check returned green (58.5s including startup/restart),
using the same local Ollama endpoint and `glm-5.3-flash:cloud` as Trial 4.
Inspection found its assertion was too weak: it accepted the introduction
before a clarification, not a completed turn, and did not await composer
readiness after restart. This result is **not completed-turn acceptance**.
That introductory text was visible and durable after 42.403s. The logged
model request took 41.1s with 20,285 input / 4,997 output tokens; the visible
text was 309 characters. This is measured request latency, not proof that
latency or full turn completion is solved. The test now answers any typed
clarification, waits for `Turn ended`, and awaits a usable resumed composer.
It still cannot replace the two planned Pocket Tasks acceptance runs.
Session: `20260918_234916_600609`. Playwright attachments retain timing and
test logs; temp homes are cleaned by the fixture. The user's port 9121 was
not restarted or used by either test.

The strengthened live check subsequently passed in about 1.7 minutes overall.
Session `20260918_235502_a73845`: question answered through the real composer,
clarify completed in 0.42s, final `text_response` at 84.629s from submission,
186-character final reply persisted and recovered after backend restart;
resumed composer readiness asserted, not just restored text. Model calls took
72.3s, 8.8s and 1.9s (83.0s total). The first reported 20,291 input / 9,168
output tokens. These timings do not establish an acceptable first-response
latency; they show where this short run spent its time. No SQLite disk-I/O
or history-version errors occurred in that test's captured logs.

Reproduce the opt-in live check from `apps/desktop` with
`LYRA_LIVE_PERSISTENCE=1 npm run test:e2e:studio -- --grep 'live requirements'`.
It is skipped by default and uses an isolated test home, not the real profile.
The normal mock-provider smoke remains in CI. E2E TypeScript checks pass.

Focused local implementation commits: `a80fea6e8` (attempt accounting),
`8c31bd8a6` (preview fingerprint), `7466b0ef9` (dispatcher health).

Web: 485 tests passed; typecheck/build passed; lint has zero errors and 30
warnings. Combined Python run: 312 tests passed across 33 files, including
all ultimate-builder tests and the affected agent/gateway/persistence suites.
An additional cross-platform process-probe regression passed after the combined
run; focused runner checks total 18 passing tests. Ruff, Windows-footgun lint,
E2E TypeScript checking and diff whitespace checks passed.

The wider Python run exposed 10 approval tests writing into the real profile
because they isolated only Kanban storage. A test-only profile fixture now
isolates their approval records as well; the 30-test file passed on rerun.
No access escalation to the real profile was needed or granted for those tests.

## Remaining boundaries

- The earlier SQLite disk-I/O failure was not reproduced in the clean test.
  Do not claim it was fixed, identify its cause from this alone, or rewrite
  persistence speculatively.
- Completed dispatch health is not per-job claim/progress proof. Capacity,
  credentials, and stalled workers still require the existing job diagnostics.
- `start.sh` still owns a foreground gateway and is not a crash supervisor.
  Managed `hermes gateway start` / the Studio button is the existing recovery
  path. No LaunchAgent was installed during this work.
- Judge/summary usage remains separately unreported. Two complete project
  journeys and managed-service recovery remain unverified.

No push or version bump is authorized by this change record.
