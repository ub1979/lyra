# QA reliability repairs — 2026-09-19

## Authority and baseline

User requested the calculator audit fixes, QA skill corrections, impact analysis,
tests and a descriptive local commit per stage. User owns the next live E2E.
Baseline `1c2c18460`; no push, version bump or runtime restart is authorised here.
Evidence: [129-call audit](../2026-09-19-calculator-repairs-retest.md).

## Stages and acceptance

1. QA execution: shared skills select existing automation before manual browser
   loops; preserve required coverage, scope ownership and truthful exit status.
2. Acceptance: parse actual requirements declarations, preserve legacy jobs,
   expose unresolved coverage rather than letting prose imply approval.
3. Browser lifetime: a bounded active owner must not lose its browser during a
   provider wait; abandoned/cancelled/crashed work must still be cleaned up.
4. Headless approval: reproduce the unavailable-input wait, then fail closed
   with an actionable handoff; distinguish timeout/unavailable input from denial.
5. Idle sleep: cover active Studio coordinator work without preventing display
   sleep or retaining protection during user input waits/after completion.
6. Startup status: reproduce the accepted-turn/ready discrepancy before editing;
   preserve single submission, reconnect and unknown-versus-zero usage.

## Change impact and boundaries

- Skills affect newly loaded worker instructions, not saved job bodies or cached
  conversation prefixes. Functional-only remains one job; Experience must not
  rerun unchanged Functional evidence or finish a non-final phase prematurely.
- Acceptance parsing is read-only. No requirements rewrite, migration, extra
  scheduler, manufactured user approval or removal of explicit NFR criteria.
- Browser/approval/power changes have cross-surface impact: test cancellation,
  absence of a responder, concurrent owners and cleanup, not only happy paths.
- Existing evidence classification already rejects zero-exit compound commands;
  retain it rather than introducing a competing classifier.
- New modules/tests stay under 400 lines. Existing large entry points receive
  thin wiring only; broad refactors are out of scope. No generated app repairs.
- Stage rollback is a local revert, preserving project evidence and user data.
  No real user settings, credentials, databases or services are modified by tests.

## Verification ledger

Stage 1: shared QA Evidence now owns execution-method preflight for both scopes,
state-reset/independent-oracle rules, bounded recovery and truthful command
results. Functional/Experience point at it; existing queue shape is untouched.
40 tests passed across focused skill delivery, worker guidance, real SQLite QA
workflow and manifest-free Node evidence. The registered skill tests verify
whole-document delivery even through restrictive tool-result budgets. Prompt
tests cannot prove stochastic model compliance; user E2E remains necessary.

Each subsequent stage records exact automated checks and limitations below.
No automated suite establishes that the live model will follow every skill or
meet the proposed call/time target. Those remain user-run acceptance checks.
