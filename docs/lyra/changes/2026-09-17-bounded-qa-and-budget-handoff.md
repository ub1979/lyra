# Bounded QA and recoverable budget handoff — 2026-09-17

## Problem and reproduction

DialogueGen QA exhausted two 90-call attempts while building its test harness,
testing, repairing defects and preparing the final report. Lyra dispatches QA
as one whole-phase task, although its existing Development path supports bounded
Kanban work units. The exhaustion finalizer generates a summary but closes the
run without supplying that summary to the existing retry-context mechanism.

## Scope and acceptance

- Reuse Hermes task dependencies, claims, failure counters, run summaries and
  comments. No new scheduler, no larger call budget, no recursive specialists.
- Dispatch QA as small dependent work units; keep shared-workspace writers
  serialized. Reuse existing tasks and retain legacy running/completed jobs.
- Warn a worker before exhaustion using only a newly created tool result:
  historical messages, system prompt and tool schema stay unchanged.
- Preserve the exhaustion summary in the closed run, explicitly as unverified
  handoff information; stale workers must not close a newer attempt.
- Test real temporary SQLite/Git lifecycle, dependency gates, retry handoffs,
  duplicate queueing, legacy jobs, terminal states and existing delegation bounds.
- Verify whether status is already reconciled before adding another status path.

## Data, compatibility and recovery

No schema migration, operator-project changes or active-job restart. New jobs
receive new instructions after the relevant runtime restarts. Preserve existing
retry limits and cancellation mechanisms. Revert scoped commits to roll back;
existing summaries and project artifacts remain readable by prior versions.

## Verification and delivery

The isolated real-model pilot exposed a second issue: the developer requested
`references/engineering-standards.md` relative to its specialist skill, where
that file does not exist. The canonical file belongs to the umbrella skill.
Correct the developer, reviewer and architect instructions to use the existing
qualified `skill_view` reference; retain skill directory traversal protections.
Verify the documented calls through real plugin registration and file loading.

Implemented using existing mechanisms:

- Four dependent QA work units use Lyra's existing work-unit queue and Hermes
  task links/claims. No new scheduler or agent-swarm tool. Legacy active and
  completed phase jobs are retained; exhausted broad jobs can be superseded.
- A 61-line handoff helper adds at most three budget notices to fresh tool
  results. This is guidance, not a guarantee that the model checkpoints. The
  existing fallback summary is mechanically saved into the closed attempt.
- Run-ID fencing prevents a late finalizer from closing a replacement attempt.
  Existing delegated-child context prevents helper exhaustion from closing its
  parent task. Tests exercise the actual agent loop, tools and SQLite.
- Studio already overlays durable job state on the prose ledger; no duplicate
  status manager was added. Worker instructions now name that authority.
- The standards reference uses the umbrella skill. No duplicated standards,
  path traversal exception, core tool, schema migration or additional model call.

Why not enable specialist swarms: existing Hermes delegation works, but Lyra's
restriction followed recursive whole-phase delegation incidents. Removing it
would revive that failure mode. Independent helper delegation can be evaluated
separately with isolated workspaces and explicit parent/child budgets.

Observed local verification:

- Baseline Hermes delegation/decomposition and project progress: 194 passed.
- Expanded builder/gateway/budget/worker integration run: 232 passed.
- After shared-reference and QA wording changes: 194 passed across 20 files.
  These scopes overlap; they must not be added into a unique-test total.
- Combined Kanban DB/core/tools and delegation suites: 700 passed, 1 skipped,
  0 failed (5 files). Local HTTP/process fixtures required sandbox escalation;
  live-service protection remained enabled.
- Ruff checks, Windows encoding checks on six new Python files, and diff
  whitespace checks passed. All new Python files are below 400 lines.
- Corrected three existing test fixtures: source-location drift for the setup
  guidance; imported default-home leakage into operator logs; and a fake-PID
  reclaim test that otherwise attempted a real signal. No live guard disabled.

## Isolated real-model pilot

Evidence root: `/private/tmp/lyra-reliability-pilot.GluKB9` (temporary, retained).
Real Hermes CLI workers, dispatcher and Kanban store; existing Ollama endpoint
with `glm-5.3-flash:cloud`, separate home/project/board, one worker at a time.
The supervisor supplied only the brief and local repository, never product
repairs. Limits: 20 calls per attempt, 10-minute overall pilot deadline.

Development produced and committed a stdlib slug CLI (`89d1bb6`). QA setup
exhausted its first attempt, persisted an explicitly unverified summary, and
the existing dispatcher began run 3 with partial work available. Downstream
QA remained gated. This verifies recovery in a real run, not overall acceptance.

The pilot also exposed disproportionate setup: an additional smoke wrapper and
tests for that wrapper despite existing real-CLI tests. QA-001 now explicitly
prefers the existing runner and adds a harness only for a demonstrated gap.
That refinement has not yet had a fresh real-model acceptance run. Four stages
add model startup/context overhead; no speed or token-cost reduction is claimed.

At the 10-minute deadline, development and QA-001 were done; QA-002 was still
running and was paused by the existing project control path. QA-003/004 remained
unstarted. The four spawned worker PIDs were confirmed absent after shutdown.
QA-001 recovered in run 3 and committed `ab3def8`; there was no supervisor edit
to the generated app. An independent read-only rerun of its 14 existing tests
passed after shutdown. This is NOT a complete app acceptance pass.

Known limitations / remaining gates:

- Budget notices did not prevent first-attempt exhaustion in this deliberately
  low-cap pilot. The durable retry worked; bounded success is still unproven.
- The tiny app did not finish all QA inside this pilot's deadline. The 20-call
  cap is lower than normal, so this is not a measured regression against the
  normal configuration, nor proof that the four-stage approach is faster.
- Worker requests started around 28k tokens and QA grew toward 48k; splitting
  alone does not solve startup context or provider latency. Measure against a
  baseline before claiming an improvement.
- A fresh complete real-model run after the setup-reuse refinement, browser
  app acceptance, clean-candidate release gates, CI and operator restart remain.
- No new UI code or assets changed; web/desktop suites were not rerun here.

Local commits: `9cea9df9c` recovery; `547da5626` shared standards;
`d4558498b` bounded QA candidate. Final focused queue/skill/gateway checks:
43 passed; queue checks after the helper rename: 35 passed (overlapping suites).
No version bump, push or operator Lyra restart. This is a locally tested
candidate, not a release sign-off.
