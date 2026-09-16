# Synced transcript refs — 2026-09-16

Change / date: every writer of the Studio transcript and activity label updates
the mirror ref synchronously before React state; 16 September 2026 (follow-up
to the event-reducer extraction reviewed the same evening).

User problem and reproduction: the reducer snapshot in `ChatPage` reads
`guidedMessagesRef` / `guidedActivityRef`. 0.19.43 updated those refs
synchronously on the reducer path, but the remaining direct callers (11
`setGuidedMessages`, 17 `setGuidedActivity`: clarification lines, user sends,
recovery, watchdog) still relied on a `useEffect` to mirror state into the ref
after render. A frame reduced in the gap between such a call and React's
commit would snapshot a stale list and write it back, dropping the line just
added (for messages) or the label just set (for activity).

In scope / explicitly deferred: `setGuidedMessagesSynced` and
`setGuidedActivitySynced` accept the same `SetStateAction`, resolve functional
updates against the ref, write the ref, then set state; all call sites use
them. The mirror effects remain as a harmless second write. Deferred: the same
treatment for usage, workers, compacting and approval, whose direct writers
outside the reducer are single-purpose (reset, approval actions) and not
adjacent to frame handling.

Acceptance criteria: web typecheck clean; all web tests pass; no lint errors;
no additional hook-dependency warnings from the new callbacks.

Affected modules and data: `web/src/pages/ChatPage.tsx`, rebuilt
`hermes_cli/web_dist`. No stored data changes.

Tests and observed results: full web check — 454 tests in 57 files, typecheck
clean, lint 0 errors. The race itself cannot be unit-tested without rendering
`ChatPage`; it is closed by construction (single writer through the ref).

Compatibility / restart: reload Studio after restarting Lyra.

Rollback / retained recovery data: revert the commit.

Local commit / authorized push: local commit; push follows the standing release
instruction.
