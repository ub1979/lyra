# Collect evidence for dependency-free Node tests

Date: 2026-09-19. Local fix; not pushed or live-journey verified.

## Problem and change

The generated app used node --test without a manifest, so no canonical command was discovered and no test evidence recorded.

Bounded conventional JS-test discovery is the fallback when explicit test commands are absent. Existing evidence classification rejects masked shell outcomes. No system prompt is rebuilt mid-session.

## Impact and verification

Real Git workspace, actual failing Node command, masked pipeline remaining unverified, subsequent passing command in the SQLite evidence store; manifest precedence and no guessed TypeScript loader.

Full results and remaining boundaries: [repair record](2026-09-19-workflow-contract-repairs.md).
No database migration or live-service restart. Revert this focused commit to
restore code; retain project data. Existing in-flight agents keep their loaded
code/tools; user testing needs a later restart/new conversation. No performance
or end-to-end sign-off is claimed.
