# Report the exact cron attempt rather than schedule existence

Date: 2026-09-19. Local fix; not pushed or live-journey verified.

## Problem and change

Completed finite one-shots delete their schedule record; immediate run then falsely reported failure.

Create/pin the existing execution-ledger attempt and read its durable outcome. Keep scheduler run/claim behavior; finalize exceptions without inventing success. No new scheduler or execution format.

## Impact and verification

Real scripts, schedule JSON and execution SQLite for successful/failed one-shots and recurring jobs; lost claim creates no attempt. Existing tool-wiring and execution-ledger suites.

Full results and remaining boundaries: [repair record](2026-09-19-workflow-contract-repairs.md).
No database migration or live-service restart. Revert this focused commit to
restore code; retain project data. Existing in-flight agents keep their loaded
code/tools; user testing needs a later restart/new conversation. No performance
or end-to-end sign-off is claimed.
