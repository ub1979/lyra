# Refinement past the warning line, and a cold-resume check — 2026-09-16

Change / date: `mergeGuidedResponse` looks past a same-turn quiet line so a
refined reply stays one bubble; the Studio smoke reloads and checks the
conversation is restored; 16 September 2026 (follow-up to 0.19.49 from the
advisor review before declaring it done).

User problem and reproduction: 0.19.49 appends the "not saved" warning as a
`plain` line right after the reply. `mergeGuidedResponse` refined a reply only
when the *last* message was that reply, so the sequence `message.start →
message.complete("A", warning) → message.complete("A, refined")` — the
existing same-turn refinement case with a warning present — produced a
second bubble. Reducer test written first; it failed with `["Answer A",
warning, "Answer A, refined"]`. Separately, the release claimed "the first
exchange now persists" on the strength of an empty gateway log; the browser
had not yet been asked to reload and show the exchange again.

In scope / explicitly deferred: the merge walks back over trailing `plain`
messages whose `turn` equals the completing turn before deciding to refine;
a notice without a turn (a job update) still ends refinement, so the
0.19.42 rule "a notice is never overwritten" is unchanged. Studio smoke:
after the two turns, `page.reload()` on the same URL, wait for the composer,
assert the "You" bubble, both echo replies and the welcome reply (three
`Echo:` bubbles) are back, and that the echo model received no new request
(a fresh session would have sent another welcome seed). Deferred: the
redundant model adoption on a session already built with the configured
model; feedback-latency visibility; real-provider failure journeys.

Acceptance criteria: the new reducer test and merge unit test pass; every
earlier merge/reducer test unchanged; web check green; the smoke passes
twice with the reload step.

Affected modules and data: `web/src/lib/guided-response-merge.ts` (+test),
`web/src/lib/guided-event-reducer.test.ts`, `apps/desktop/e2e-studio/
studio-smoke.spec.ts`, rebuilt `hermes_cli/web_dist`. No stored data changes.

Tests and observed results: reducer test written first, failed as described;
after the merge change `npm --prefix web run check` — 58 files, 462 tests
(+3: reducer refinement-after-warning, merge past-same-turn-line, merge
other-turn-line-still-ends-refinement), 0 lint errors. Studio smoke with the
reload step against the rebuilt bundle: passed twice (15.4 s, 13.2 s) —
"You" bubble, both echo replies and the welcome reply restored, and the echo
model received no request during the reload. `tsc -p tsconfig.e2e.json`
clean; version tests 19/19.

Compatibility / restart: none.

Rollback / retained recovery data: revert the commit.

Local commit / authorized push: local commits `fix(studio): refine a reply
past its own warning line` and `chore(release): bump Lyra to 0.19.50`;
pushed after the 0.19.49 CI run completes.
