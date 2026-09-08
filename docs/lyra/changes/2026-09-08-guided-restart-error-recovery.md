# Guided restart error recovery — 2026-09-08

Change / date: Keep a temporary dashboard restart out of the durable guided
conversation, 2026-09-08.

User problem and reproduction: During the 0.19.27 release-candidate restart,
the open Hello project chat briefly failed its pre-WebSocket HTTP status probe
with the browser-native `TypeError: Failed to fetch`. The chat later reloaded
and was usable, but Studio had already stored a permanent orange Problem
message saying the project chat could not connect. This made a successful
recovery look like a current failure.

In scope / explicitly deferred: Classify only native browser network failures
from WebSocket setup as transient, retry the same saved PTY attachment with the
existing bounded backoff, and do not persist the temporary failure. Once a
connection opens, remove legacy connection-only errors left by earlier builds.
Continue surfacing authorization, configuration, model, and application errors.
Do not change the PTY protocol, backend process lifetime, or message content
unrelated to connection recovery.

Acceptance criteria: A dashboard restart automatically reconnects an open
guided chat. A temporary fetch failure is not added to durable chat history.
Successful reconnection removes an obsolete connection-only error while
preserving real model/application errors. Authentication failures remain
visible.

Affected modules and data: `ChatPage.tsx`, one pure recovery policy module and
its tests, the Lyra changelog, maintenance map, and generated file inventory.
No backend, database, conversation, or project migration.

Tests and observed results: Pure tests cover Chrome/Firefox and Safari-style
network errors, non-transient authorization/setup failures, selective cleanup,
and identity preservation when no cleanup is needed. The web suite, typecheck,
lint, production build, and a real dashboard restart/resume smoke test are
required before push.

Compatibility / restart: A rebuilt Studio page is required. Existing saved
messages and project conversations remain intact; only obsolete connection-only
Problem rows are removed after a successful reconnection.

Rollback / retained recovery data: Revert the focused commit. No backend or
project data is changed.

Local commit / authorized push: The user authorized inclusion in the combined
Lyra 0.19.27 release and push on 2026-09-08.
