# Avoid redundant startup provider switching

Problem: named providers are initially represented by their resolved provider
class and endpoint. Comparing that class with the configured name caused an
unnecessary first-turn switch and history marker even when the model and
endpoint already matched.

Scope: compare provider identities at config adoption; preserve genuine model
and endpoint changes, ordinary pinned-session behavior and history fencing.
Normalize endpoint scheme/host and trailing path slash, but preserve path and
query case. No stored-data changes, provider calls or tool-schema changes.

Acceptance: equivalent identities cause no switch/note; different endpoints
or models still switch; persisted replies survive reopening SQLite and the
Studio browser reload journey. Resolver failures must not claim equivalence.

Affected: tui_gateway/provider_identity.py, server.py, provider-identity and
turn-history tests, version metadata and maintenance map.

Verification: 557 tests passed across the gateway and map suites; 462 web
tests passed with typecheck, production build and lint (zero errors; existing
warnings remain). Ruff and Windows-footgun checks pass on the touched Python
files. Studio browser smoke passed (15.8 seconds), including cold reload of
both replies without a new welcome request. The turn-history test also opens
a fresh SQLite connection to verify the saved reply. CI is verified after push.

Recovery: revert this change if needed; no migration. Restart the backend to
load the fix; do not interrupt active jobs. This release does not claim all
history conflicts or long-running provider failures are solved.

Release: user explicitly authorized completion and push as 0.19.51.
