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
Stage 2: dedicated requirement declaration parser supports skill-produced
bullets/headings plus existing tables, ignores fenced examples and narrative
references, and rejects duplicates/unbounded input. Parent FR, child AC and NFR
IDs all survive; shared evidence avoids duplicate tests. Explicit report-level
uncertainty remains needs-review even if every result row says PASS. Job notices
and coordinator QA instructions put structured acceptance above Brain/prose.
58 tests pass across parser, real queue/report files, notifications and policy.
The first run caught notification prompt growth; it was shortened to preserve
the existing 1100-character ceiling rather than weakening that test.
No retroactive job repinning or scheduler semantics change. Completion wording
is model guidance, not a claim that arbitrary model text is mechanically censored;
the existing structured UI/status overlay remains the authoritative warning.

Stage 3: `browser_request_lifetime.py` protects the owning task (including its
local sidecar) only during an actual streaming/nonstreaming provider call,
bounded by the existing finite request timeout. Cancellation, exception and
expired ownership release protection; successful return gets ordinary idle
grace to reach the next browser action. No heartbeat claims progress and no
keepalive tool calls are generated. Normal Python idle cleanup remains active.
The daemon's independent timer becomes a finite crash fallback, using its
one-hour floor plus configured provider/model request bounds and idle grace.
Explicit external daemon-timeout overrides remain respected. Temporary screenshot
fallback browsers are scoped to one command and retain their short timer.
61 tests passed across real cleanup/agent forwarders, browser hardening and
orphan cleanup; headed and Lightpanda compatibility tests also passed (56).
Clock-controlled delay exceeds the former 120s expiry without a live provider.
No real user browser is opened for acceptance testing; user owns that run.
An extra browser compatibility run used an overly short 40s file timeout and
timed out in existing hardening discovery; the full hardening file above passed
with the normal runner limit in 141s. This was a test-run limit, not a pass.

Stage 4: reproduced the headless CLI callback entering a modal queue with
`_app=None` before implementation. It now fails closed immediately; timeout and
unavailable input use a deny-compatible value with explicit reason. Both command
and generic tool approval paths preserve the reason, with a needs_input handoff
instruction instead of claiming the user denied or granting permission. No new
approval channel and no security bypass. Interactive choices remain unchanged.
357 approval tests passed with one separately confirmed baseline failure excluded;
the final six headless/timeout regression cases also passed. The excluded
`test_nonrecursive_verification_artifact_cleanup_is_not_dangerous` returns the
same root-path denial on this Mac at baseline `1c2c18460` and current source for
both temporary-file prefixes. It is not fixed by loosening security in this set.
Actual worker-to-user handoff remains a user live-test item; these tests establish
fail-closed command handling and absence of the unreachable five-minute wait.
No automated suite establishes that the live model will follow every skill or
meet the proposed call/time target. Those remain user-run acceptance checks.
