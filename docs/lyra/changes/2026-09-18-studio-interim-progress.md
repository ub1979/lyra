Change / date: Studio interim progress, 2026-09-18
User problem and reproduction: A guided turn can run for minutes without a visible assistant update. The gateway emits `message.interim`, Ink and Desktop consume it, but the Studio event reducer ignores it and buffers `message.delta` without showing it.
In scope / explicitly deferred: Render existing interim assistant segments in Studio without starting model turns. Profile, QA and context fixes are separate plan slices.
Acceptance criteria: Interim text appears within one second of the event; final completion does not erase or duplicate it; an interim cannot complete a turn, approve work or advance phases. Reconnect and malformed events do not create false replies.
Affected modules and data: Studio event reducer and its behavioral tests; persisted browser transcript gains interim assistant lines. No server or project-data migration.
Tests and observed results: 472 full web tests passed, including interim reducer/frame cases; web typecheck passed; web lint had 0 errors and 30 existing warnings. Browser event-to-render timing remains to be measured on a controlled delayed-model journey.
Compatibility / restart: Reload the rebuilt Studio frontend; gateway protocol is unchanged.
Rollback / retained recovery data: Revert this focused change; existing transcript lines remain ordinary assistant messages.
Local commit / authorized push: `cd5a5e742`; not pushed.
