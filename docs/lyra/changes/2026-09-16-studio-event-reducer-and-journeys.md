# Tests that see the conversation — 2026-09-16

Change / date: extract the Studio conversation's WebSocket event handling into a
pure, tested reducer fed by real gateway frames; add journey and cross-stage
invariant tests; 16 September 2026.

User problem and reproduction: between 0.19.38 and 0.19.42 the user found six
bugs that hundreds of passing tests missed, the last being a reply overwritten
on screen by a notification turn. The web suite had 46 pure-helper test files,
3 component and 2 page files, and nothing that exercised `ChatPage.tsx`, where
every event was handled inline in a 480-line `if` chain inside an effect. The
sequence "reply completes → notification starts a new turn → its reply
completes" could not be tested at all.

In scope / explicitly deferred: (1) `tests/tui_gateway/test_lyra_project_workflow.py`
gains `test_notification_turn_after_reply_keeps_both_replies`, which drives a
real worker, the real poller and the real turn path, and captures the gateway's
frames; `tests/tui_gateway/frame_fixtures.py` normalises them into
`tests/fixtures/studio_frames/*.jsonl` (regenerate with
`LYRA_WRITE_FRAME_FIXTURES=1`, now forwarded by `scripts/run_tests.sh`) and
fails on event-sequence drift. (2) `web/src/lib/guided-event-state.ts`,
`guided-event-reducer.ts`, `guided-tool-events.ts`: `reduceGuidedEvent(state,
event, ctx) → {state, effects}` covers every non-clarify event with injected
clock and ids; four effect kinds (`agentReady`, `persistSessionId`,
`openSkillsDialog`, `autoContinue`) carry decisions back to ChatPage. ChatPage
snapshots its existing refs, reduces, writes changed slices back to the existing
setters and refs synchronously, and runs effects; `finishGuidedResponse` and
`appendGuidedError` are thin wrappers. Vitest replays the committed frames
through the reducer. (3) `tests/tui_gateway/test_coordinator_invariants.py`
follows four guarantees across every stage each crosses. Deferred: collapsing the
8 mirror refs and 28 state slices into one store; `clarify.*` stays in
`useGuidedClarification`; a Studio Playwright smoke is the next change record.

Acceptance criteria: two turns without a user message between them leave two
replies (unit test, real-frame replay, and Python journey agree); a `timed_out`
update is one quiet line and no turn in all three; the reducer never reads the
clock or randomness; schema/gate/handler/queue refuse a worker together; the
Project Brain survives `_budget_for_agent` → per-result → aggregate; a rejected
claim leaves the session idle and the next completion still gets exactly one
turn; two attempts sum in `project_run_state`; existing panel, watchdog and
clarification tests pass unchanged; `ChatPage.tsx` shrinks by ~340 lines.

Affected modules and data: `web/src/lib/guided-event-state.ts`,
`guided-event-reducer.ts`, `guided-tool-events.ts` (new), `web/src/pages/ChatPage.tsx`,
`tests/tui_gateway/frame_fixtures.py` (new), `tests/tui_gateway/test_lyra_project_workflow.py`,
`tests/tui_gateway/test_coordinator_invariants.py` (new),
`tests/fixtures/studio_frames/` (new), `scripts/run_tests.sh` (one forwarded
variable), rebuilt `hermes_cli/web_dist`. Saved browser transcripts are read
unchanged.

Tests and observed results: journey file 5 passed including the new journey and
drift check; `guided-event-reducer.test.ts` 17, `guided-event-reducer.frames.test.ts`
2, `guided-tool-events.test.ts` 6; full web check 454 tests in 57 files,
typecheck clean, lint 0 errors; `test_coordinator_invariants.py` 4 passed.

Compatibility / restart: restart Lyra and reload Studio (bundle rebuilt).
Behaviour is intended to be identical; the reducer reproduces the captured
frames.

Rollback / retained recovery data: revert the commit; fixtures are inert.

Local commit / authorized push: local commits; push follows the standing release
instruction. Regression discipline from here: a bug report becomes a frame
fixture or journey, then a reducer test, then the fix — in that order.
