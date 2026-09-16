# Packaged-app launch spec meets the first-run gate — 2026-09-16

Change / date: the packaged-app launch spec accepts the first-run setup
choice as the end of automatic boot; 16 September 2026 (follow-up to
0.19.47 after its CI run).

User problem and reproduction: in the 0.19.47 run (35149630733) every job was
green except `Desktop E2E / Packaged app (Linux)`: the app now packs,
validates and launches (three of four launch tests pass), but `boot progress
overlay fades out or shows error state` timed out after 60 s. The uploaded
page snapshot shows a booted shell with the first-run overlay on top —
heading "Set up Lyra", the "Connect to existing Lyra" and "Install Lyra
locally" choices — and the progress status "Starting Lyra… / Waiting for
first-run setup choice / 12%". That pause is intentional
(`apps/desktop/electron/first-run-setup-gate.ts`, added 2026-07-17): a fresh
sandbox has no Lyra install and no backend to attach to, so boot hands over
to the user. The spec predates the gate and treats any "waiting" text as boot
in progress.

In scope / explicitly deferred: `apps/desktop/e2e/launch-packaged-app.spec.ts`
returns success when the root text contains "first-run setup choice", before
the boot-indicator scan; the test title says what it now accepts. Deferred:
driving the choice itself (clicking "Connect to existing Lyra" and connecting
to a mock backend) — a real packaged-app journey for a later change; the two
local-only `billing/index.test.tsx` failures noted in the 0.19.47 record.

Acceptance criteria: the packaged job's four launch tests pass in CI; nothing
else changes.

Affected modules and data: `apps/desktop/e2e/launch-packaged-app.spec.ts`
only (plus version literals and this record). No stored data changes.

Tests and observed results: cannot be run locally without packaging the macOS
app; `tsc -p tsconfig.e2e.json` clean. Verified by the CI run after this
push. The 0.19.47 run otherwise: 34 of 35 jobs green, including all eight
Python slices, the new `file-index` job, Electron E2E (37 passed) and the
Studio smoke.

Compatibility / restart: none.

Rollback / retained recovery data: revert the commit.

Local commit / authorized push: local commits `test(desktop): first-run
setup choice ends the packaged boot check` and `chore(release): bump Lyra to
0.19.48`; pushed under the standing release instruction.
