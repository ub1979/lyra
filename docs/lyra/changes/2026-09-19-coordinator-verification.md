# Capability-compatible coordinator verification

Date: 2026-09-19. Local fix; not pushed or live-journey verified.

## Problem and change

The calculator coordinator spent 29 extra calls after handoff because verification demanded a shell it did not have.

Generic verify-on-stop receives actual tool names and requests one honest handoff when terminal is unavailable. Normal workers retain execution verification. Studio excludes cron script execution at construction; file protection is unchanged and shell-capable agents create temporary scripts through their terminal.

## Impact and verification

Real agent loop with controlled provider, real verification store, retained worker verification, cache stability, and real coordinator tool-schema resolution.

Full results and remaining boundaries: [repair record](2026-09-19-workflow-contract-repairs.md).
No database migration or live-service restart. Revert this focused commit to
restore code; retain project data. Existing in-flight agents keep their loaded
code/tools; user testing needs a later restart/new conversation. No performance
or end-to-end sign-off is claimed.
