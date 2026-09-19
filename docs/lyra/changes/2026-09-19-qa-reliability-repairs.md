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

Stage 5: `agent/request_power.py` reuses caffeinate for active Studio coordinator
provider requests on macOS, with owner PID and existing request-timeout bounds.
It requests idle-system protection only (not display protection), releases on
return/error and has bounded child cleanup. Missing capability is nonfatal.
Workers retain their existing guard; other platforms/noncoordinators are no-ops.
This closes the observed post-worker coordinator-request gap; it does not claim
to prevent forced sleep/lid closure or protect arbitrary idle user waits.
The 42 focused tests across power, browser request ownership, worker spawning and
Studio policy pass. The first test run caught an over-broad subprocess mock in
the new test; replaced it with a module-local OS boundary before rerunning.
No real macOS power setting or live Lyra process was changed.

Stage 6: extracted the terminal-paint merge decision into a 14-line helper.
The previous phase expression reproduced ready/idle during a structured active
first request and reconnect (two failing regressions). Structured ownership now
blocks all terminal phase overrides, not only a terminal response; raw terminal
errors cannot settle a structured turn either. Terminal-only fallback remains,
and authoritative completion still settles normally. No submission, PTY lifetime,
watchdog deadline, token-accounting or profile routing change.
All 495 web tests, typecheck and production build pass. Lint: 0 errors, 30
warnings. Bundle rebuilt for the existing dashboard delivery path. Combined
Python plugin/runtime regression run: 477 passed across 38 files. New tests and
helpers all remain under 400 lines; large legacy integration files are unchanged
in size materially or reduced. Broader core request-path verification is below.
No automated suite establishes that the live model will follow every skill or
meet the proposed call/time target. Those remain user-run acceptance checks.

Final coverage review: bullet declarations now use the same ID vocabulary as
tables, rather than recognizing only FR/AC/NFR. This prevents a mixed document
from silently dropping security, user-story or other explicitly labelled
requirements. Three format-parity regressions plus the real queue/report suite
pass (31 tests). Narrative references remain excluded. No job repinning, change
to stage count or expansion beyond the document's declared requirements.

## Broader verification and test-environment finding

Core request-path run: **2,380 passed, zero failed, 160 files**, using the canonical
runner over `tests/run_agent/`, `tests/agent/test_turn_context.py`,
`tests/agent/test_cron_inline_api_call_62151.py` and
`tests/cron/test_cron_direct_api_call_62151.py` (8 workers, 42.6s).
Includes streaming, cancellation, retries, provider switching, compression and
conversation persistence. This does not mean the entire repository suite ran.

The initial broad run was not green: the runner reported 1,484 passed / 473
failed, plus fixture/collection errors. Two first-failure reproductions showed
agent initialization trying to open the real `~/.hermes/logs/agent.log` before
reaching the changed request forwarders. `run_agent._hermes_home` is captured
during collection; the per-test HERMES_HOME fixture is too late for that cache.
That logging path is unchanged from baseline. Do not give tests access to the
live installation to hide this isolation problem.

For the successful rerun, a temporary pytest plugin set HERMES_HOME to a
`tempfile.TemporaryDirectory(prefix="lyra-core-audit-", dir="/private/tmp")`
at plugin import, before test collection, and registered its cleanup with
`atexit`. It was loaded via `-p lyra_audit_isolation_probe` through
`scripts/run_tests.sh`; no test assertions or product behavior were mocked by
this probe. Per-test isolation remained active. The temporary probe was removed
after the run and is not shipped. Permanent collection-time test isolation is
still a harness follow-up; the unmodified sandbox invocation remains affected.

Final checks: Python lint and diff whitespace clean; searchable tracked-file
inventory current. The separate Mac approval-test baseline failure remains as
documented above. No claimed clean full-repository or live acceptance result.

## Local commits and user handoff

| Commit | Stage |
|---|---|
| `2d89980b5` | Shared efficient, truthful QA execution contract |
| `983106bfc` | Requirement coverage and unresolved acceptance |
| `dfbe7bf97` | Browser ownership during bounded provider requests |
| `6d4ff1d0b` | Headless approval fails closed without unreachable modal wait |
| `711ccc95d` | Active Studio coordinator request idle-sleep protection |
| `d49f45aa4` | Structured status remains authoritative over terminal paint |
| `ff40ed32e` | Requirement-ID vocabulary parity across tables and bullets |

All are local. Version remains 0.19.64; no release or push. Production frontend
assets are rebuilt. No live services, settings, saved conversations, queued job
bodies or generated calculator source were changed.

For the user's test, after existing work is safely stopped, restart dashboard
and gateway from this checkout and reload Studio. Start a fresh small Personal
project so its jobs receive the new immutable instructions. Check:

1. Submit once. Accepted work must stay visibly active until an authoritative
   completion/input request; terminal repaint or reconnect must not say ready.
2. Approve the preview normally; one coordinator and no duplicate worker jobs.
3. QA records its execution method before repetitive browser actions, reuses
   available automation and tests real actions. It must preserve failed runs
   and report untested requirements, not fabricate a clean verdict.
4. Compare QA call count and active time with the previous 129-call trace,
   separating human wait, provider time and actual sleep. No speed claim is
   established by unit tests. A required check may legitimately need input.
5. Browser state survives a model wait over 120 seconds. A genuinely blocked
   approval fails closed and requests help rather than waiting invisibly.
6. Display sleep may occur during work; ordinary system idle sleep is guarded
   during active worker/coordinator requests. Forced sleep/lid closure is not
   prevented, and a conversation waiting for the user should not hold a guard.
7. Inspect the generated app directly against its requirements. A completed job
   and available evidence are not independent proof that the app is correct.

Rollback uses focused revert commits; no data migration or project deletion is
needed. Review dependencies when reverting browser or power stages because both
have thin hooks in the same AIAgent request forwarders.
