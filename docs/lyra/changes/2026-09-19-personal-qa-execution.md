# Personal QA execution efficiency — 2026-09-19

## Problem and scope

Calculator QA completed correctly, but consumed 90/90 model calls in 11m12.
Its trace contains 84 browser tool invocations, mostly separate type/click/read
steps. This was not a dispatcher stall and raising the limit does not address
the cause. Keep the existing single Personal QA item and real evidence gates.

Change only the Personal QA worker's initial assignment: reuse a repeatable
browser runner where available, execute complete sequential journeys with
assertions per run, map overlapping criteria to the same evidence, and keep
numeric permutations in the automated suite after checking UI wiring. Keep
real keyboard, error, reload and narrow-layout checks. No blanket test skipping,
fabricated passes, new core tools, nested workers or altered call limits.

Browser batching must use actual browser automation, not assigning DOM values
or invoking application functions. Missing automation uses available browser
tools with explicit limitations, not repeated installation attempts or weakened
coverage. Never grant permissions, modify installed applications or bypass macOS
protection to obtain a screenshot.

## Impact and acceptance

Affected: worker_guidance.py and real SQLite queue tests. New Personal QA tasks
receive the guidance; existing saved tasks and other profiles/phases do not
change. No historical prompt mutation or cache invalidation. Reuse normal Hermes
terminal/browser tools; no new dependency or framework.

Tests must show guidance in actual queued Personal QA bodies, absence in other
profiles, preservation of terminal failure evidence and final QA gating, and
idempotent reuse of existing jobs. Run the plugin suite through run_tests.sh.
Instruction tests cannot prove the model uses fewer calls: live performance is
not measured until a fresh QA assignment runs. Do not claim a time guarantee.

Recovery: revert the focused commit. Saved work/evidence are retained. Running
jobs are not restarted. No version bump or remote push for this local change.

Results:
- `scripts/run_tests.sh plugins/ultimate-builder/tests -q`: 210 passed.
- Focused guidance/QA suites: 24 passed, including actual SQLite queued bodies,
  profile isolation, existing-job reuse and QA completion/dependency contracts.
- Ruff: both changed Python files pass. Guidance file is 127 lines; tests 196.
- Windows-footgun lint also passed for both changed Python files.
- No budget increase, coverage gate removal, worker role change or core edit.
  The full QA skill remains intact; this Personal assignment narrows execution
  strategy, not the evidence required to approve the core behavior.
- This is an instruction-level efficiency fix, not a guaranteed model behavior
  or measured latency result. A new live QA task is still needed to compare
  model-call count and elapsed work time against the 90-call/11m12 baseline.
