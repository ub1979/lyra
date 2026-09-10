# Agent-picker Chrome repaint — 2026-09-10

Change / date: Keep the scrolled project-agent picker painted after selection
changes in Chrome, 2026-09-10.

User problem and reproduction: In the real Lyra Studio project-agent dialog,
scroll down and select or deselect an agent. Chrome 152 updates the checkbox,
selected count, and accessibility tree, but stops painting the dialog's
scrollable content; the user sees a blank white panel. Scrolling forces the
unchanged controls to reappear. The same failure reproduced repeatedly in the
user's `urdu_song_dataset` project.

In scope / explicitly deferred: Promote only the agent dialog's scrollable
content to its own compositor layer so state updates repaint that layer. Keep
the existing dialog geometry, background blur, selection state, focus, model
choices, and save/cancel behavior. Do not change agent recommendations or the
project workflow.

Acceptance criteria: After the list has been scrolled, repeated agent checkbox
changes remain visibly painted without requiring another scroll, while the
selected count and model controls still update normally. The invariant is
covered by the dialog policy test and verified in the real Chrome path.

Affected modules and data: `web/src/lib/guided-specialists-dialog.ts`,
`web/src/pages/ChatPage.tsx`, the focused web test, changelog, maintenance map,
and generated file inventory. No project, database, or conversation migration.

Tests and observed results: The focused dialog policy suite, web typecheck,
lint, and production build pass. In Chrome 152, the rebuilt dashboard was
opened on the user's real project, the agent list was scrolled to the bottom,
and Project Brain was selected and deselected repeatedly. The count and card
state updated while the dialog remained painted on every change. The test
selection was cancelled rather than saved.

Compatibility / restart: Rebuild and restart the dashboard, then reload the
page. Existing projects, conversations, and unconfirmed agent choices are
preserved.

Rollback / retained recovery data: Revert the focused local commit. No user
data is rewritten.

Local commit / authorized push: The user explicitly authorized fixing,
versioning, and pushing this defect on 2026-09-10. Release as Lyra 0.19.30.
