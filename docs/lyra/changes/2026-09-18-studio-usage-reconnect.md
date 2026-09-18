Change / date: Studio usage reconnect, 2026-09-18
User problem and reproduction: The Pocket Tasks trial showed a known coordinator total become “Not reported yet” after Studio reload while worker usage stayed visible.
In scope / explicitly deferred: Retain the last known coordinator snapshot only for the same workspace and saved conversation ID. Keep worker usage in its existing project job source. No new token aggregation or liveness timer.
Acceptance criteria: Empty session.info usage does not erase a known same-session total; a new conversation cannot inherit it; genuine zero remains zero; project-worker totals remain separate.
Affected modules and data: Studio usage cache keyed by workspace/session and event effect wiring. Browser localStorage only.
Tests and observed results: Full web suite (472 tests) and typecheck passed; same-session and cross-session cache behavior has focused unit coverage. Live browser reload remains for the user's acceptance journey.
Compatibility / restart: Reload rebuilt Studio.
Rollback / retained recovery data: Revert client usage cache; entries can be ignored and are not project data.
Local commit / authorized push: `69511b43b`; not pushed.
