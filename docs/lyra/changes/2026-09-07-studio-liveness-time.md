# Studio liveness and message time

User problem: Studio can look stuck with no cancellation control after a
reconnect. Provider wait notices arrive every 30 seconds and are counted as
real model progress, indefinitely postponing the browser silence watchdog.
Messages also do not show when they were sent or received.

Reproduction: resume a session whose backend reports `running=true` while the
browser activity state is idle, or emit provider-wait `thinking.delta` frames
without a real reasoning/message event. The activity card is absent after the
resume, and provider-wait frames reset the silence clock.

In scope: distinguish provider-wait status from genuine model output, restore
the visible running state from `session.info`, keep Stop & retry available, add
local date/time labels to Studio messages, and show the last saved activity
time for project jobs. Browser notifications and generated projects are not
changed.

Acceptance: a resumed busy session immediately presents as active; provider
wait notices update the explanation without resetting the genuine-output
clock; the existing bounded watchdog can stop a silent turn; real reasoning
still resets it; every newly created user, Lyra, question, approval, and error
message carries a timestamp; old timestamp-shaped message IDs remain readable.

Data/security: timestamps remain in the existing project-scoped browser
storage. No conversation text, notification permission, credential, project
file, or project repository is changed.

Verification: 191 focused Python gateway/builder/release tests and all 392 web
tests pass. Web type checking and the production build pass. Lint reports no
errors (31 pre-existing warnings remain elsewhere). The Lyra file index and
diff checks pass.

Compatibility/restart: the dashboard frontend and embedded runtime must be
rebuilt; a full Lyra restart is required after release.

Rollback: revert the focused commit. Stored messages without timestamps remain
compatible.

Local commit / authorized push: pending / authorized by the standing Lyra
release instruction to increment the patch version and push each completed
change set.
