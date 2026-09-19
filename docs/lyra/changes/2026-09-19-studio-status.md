# State-derived coordinator status and explicit usage limits

Date: 2026-09-19. Local fix; not pushed or live-journey verified.

## Problem and change

Studio always displayed Lyra available, and unknown detailed counters looked like zero.

Use existing PTY/structured-feed/turn state for connecting, disconnected, working and ready labels. Scope feed status to its connection, retain separate worker totals, show unknown counters as dashes, and disclose excluded auxiliary usage.

## Impact and verification

Web state and rendered-panel tests, null-counter and spawn-without-usage regressions, typecheck/lint, and rebuilt tracked Studio bundle.

Full results and remaining boundaries: [repair record](2026-09-19-workflow-contract-repairs.md).
No database migration or live-service restart. Revert this focused commit to
restore code; retain project data. Existing in-flight agents keep their loaded
code/tools; user testing needs a later restart/new conversation. No performance
or end-to-end sign-off is claimed.
