# Replies keep their turn identity — 2026-09-16

Change / date: a completed Studio reply may overwrite only the reply of its own
model turn; replies from other turns and quiet notices stay on screen;
16 September 2026.

User problem and reproduction: after restarting the Hello conversation on
0.19.41 the user saw Lyra's replies being replaced by newer ones. Cause:
`finishGuidedResponse` in `web/src/pages/ChatPage.tsx` replaced the last message
whenever it was an assistant message. That rule assumed one reply per user
message, but a saved-job notification starts its own turn without a user
message in between: at 16:49:35 Lyra answered "build the remaining project",
and at 16:49:42 the completion-notice turn's reply replaced it. The database
holds both replies; the browser showed one. Turn-free notices (0.19.40) are
also assistant-role lines and were exposed to the same overwrite.

In scope / explicitly deferred: new `web/src/lib/guided-response-merge.ts`
(`mergeGuidedResponse`) replaces the last assistant message only when it is not
`plain` and carries the same `turn` sequence; `ChatPage` counts turns on
`message.start` and tags each appended reply with it. Restored messages without
a turn are never overwritten. Deferred: rendering both the reply and the notice
differently (they remain plain assistant lines).

Acceptance criteria: two completions within one turn refine one message; a
second turn's reply appends after the first turn's reply; a notice or approval
line is never overwritten; a restored reply without a turn is kept.

Affected modules and data: `web/src/lib/guided-response-merge.ts` (new),
`web/src/pages/ChatPage.tsx`, rebuilt `hermes_cli/web_dist`. Saved browser
transcripts gain an optional `turn` field; older entries load unchanged.

Tests and observed results: `web/src/lib/guided-response-merge.test.ts`
5 passed; full web check: typecheck clean, vitest and lint pass.

Compatibility / restart: reload Studio after restarting Lyra (bundle rebuilt).

Rollback / retained recovery data: revert the commit; the extra `turn` field in
saved transcripts is ignored by older builds.

Local commit / authorized push: local commit; push follows the standing release
instruction.
