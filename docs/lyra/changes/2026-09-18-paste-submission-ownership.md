# Paste submission ownership — 2026-09-18

## Evidence before change

Identical browser, dependencies, model fixture, built Ink source and five Studio
journeys per detached checkout: 0.19.62 (`2994421fa`) failed 2/5; candidate
0.19.63 (`9fdc1358a`) failed 2/5. Each failure sent the collapsed first-turn paste
label rather than full setup. No changes between those commits in Ink input,
Studio chat wiring or the smoke test. This disproves attributing the symptom
solely to the latest QA fixes; it does not locate its original introduction.

## Proposed boundary and impact

Confirm with real mounted composer/submission hooks: paste metadata currently
uses React state, while the text input can submit its current ref before that
state has rendered. A queued message must also retain complete text after the
composer clears its snippets. Keep paste ownership in the composer; snapshot
expanded input before clear/queue/steer rather than add timing delays or a
second Studio transport.

Affected: Ink CLI and embedded Studio paste, send, queue, queue edit, busy steer,
history recall and session reset. Desktop's separate React composer and
messaging gateway inputs are not rewired. Plain text, file/image drops, slash
commands and explicit session clearing must retain their existing behavior.
No database migration, prompt-history edits or model/tool-schema changes.

Acceptance: deterministic stale-render regression red before/green after;
queue/clear/session isolation, existing Ink suite, repeated real Studio smoke,
web checks and Python workflow regressions. New focused units below 400 lines.
Rollback: revert scoped source/test commit and rebuild Ink; no data cleanup.

## Confirmed implementation

The mounted real Ink composer and submission hooks reproduced both immediate
send and queue loss before modification. Paste metadata now has synchronous
ref ownership (matching the existing queue pattern), with React state as its
rendered view. Submission resolves text exactly once before clearing.

Expanded queued pastes carry a small literal-text value, while explicit queued
commands remain strings. This is necessary to avoid executing a pasted shell
example when the queue drains. Queue display/edit/force-send types were traced
and updated; session clearing uses the same synchronous setter. No new scheduler
or transport. The two changed hook files remain below 400 lines.

Focused checks: 28 passed across five files, including six mounted-hook cases;
typecheck, targeted lint and Ink build passed. Repeated browser verification and
full-suite baseline comparison are pending. An initial unrestricted parallel
Ink run hit EMFILE watchers, three heap-test timeouts and four theme assertions;
the four theme assertions also fail on the unmodified baseline. No unrelated
theme code is being changed to hide those failures.

## Subsequent evidence: release still held

Clean repeated browser runs after the patch produced 9/10 and then 8/10 passes;
failures still sent a collapsed label instead of full setup. A diagnostic build
with synchronous file logging passed 10/10, but does not invalidate the clean
failures: instrumentation can alter timing. The patch is not sufficient yet.
The bounded full Ink run had 1,369 passes, seven failures and one skip. The same
seven failures reproduced in the three affected suites on the old baseline
(four theme assertions and three heap-test timeouts). No release acceptance.

Follow docs/lyra/END_TO_END_ACCEPTANCE.md for the agreed project trial, ownership
rules and resume checkpoint. Resolve the real input boundary before that trial.

## Remaining caller identified

Failure-only trace captured `resetSession` with no existing session, followed
by `create-complete`, between storing the paste and pressing Enter. Initial
session.create completion clears metadata for a draft already accepted by Ink.
Impact: distinguish initial bootstrap from replacing an existing conversation;
retain startup draft metadata only for the former. Explicit resets, resume and
live-session switches must still clear old metadata. No context/cache changes.
Add a real mounted lifecycle/composer/submission regression with a deferred
session.create reply, plus existing-session isolation coverage, before editing.

That regression failed on startup and passed on existing-session isolation
before the fix. After preserving draft metadata only when create has no prior
session, four focused suites passed 22/22, typecheck and targeted lint passed.
Ten real Studio browser journeys passed with ALL diagnostic logging removed.
This verifies the input fix within this scope; the project acceptance trial and
overall release gates remain separate. Root Ink bundle rebuilt; existing user
processes not restarted. Temporary diagnostic code was removed from the test
checkout; only the same lifecycle fix remains there.
