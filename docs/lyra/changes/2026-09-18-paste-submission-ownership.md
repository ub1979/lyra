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
