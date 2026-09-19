# Studio startup submission lifecycle — 2026-09-19

## Problem and evidence

Two startup-only browser probes submitted the New Project form exactly once.
Studio pasted the seed, closed that PTY connection 6ms later, and never sent
Enter. No inference began. See `../2026-09-19-calculator-e2e-followup.md`.
Removing the builder URL parameter invalidates the session-lookup readiness
flag, which is a terminal-effect dependency. This closes the socket between
paste and delayed submission. The delayed writer also checks the new socket
but sends on the old captured socket.

## Scope and impact

Keep the new workspace's session lookup resolved when consuming its seed;
existing-session lookup, workspace switches and empty-chat behavior stay intact.
Bind every delayed guided write's readiness check to the socket receiving that
write. No new chat transport, scheduler, model tool, context mutation, database
migration or automatic retry. A disconnected paste must not send Enter to a
replacement session. Existing pending input is not silently replayed.

Acceptance: actual New Project UI reaches the model once, preserving the full
brief and one setup block; reload does not resubmit; subsequent user turns work.
Existing empty-chat, history/restart and paste tests remain green.

## Verification and recovery

Add a real-dashboard/Ink/mock-provider browser regression before the fix, then
run it on both versions. Run web checks and rebuild tracked assets. Record
results below. No running user service is restarted as part of testing.
Rollback uses a local revert and asset rebuild; no user data is removed.
Local commits only; no push or version bump authorized.

Results:
- Baseline real-browser regression: 0 model requests after 30s (expected 1).
- Fixed build: 2 Studio browser tests passed, including the existing two-turn,
  reload and full dashboard restart test; 1 opt-in live-provider test skipped.
  New Project submission/reload/follow-up test completed in 3.8s.
- 491 web tests, 6 real mounted Ink paste tests passed; TypeScript/build passed.
  ESLint: 0 errors, 30 existing warnings. Production assets rebuilt.
- Harness corrections are explicit: normalize macOS /var → /private/var fixture
  paths, assert the existing "Lyra ready" label, and disable independent title
  generation in the isolated fixture so request counts measure user turns.
- Delayed-write tests cover socket closure, replacement, unmount and unchanged
  connection. All six guided writer call sites use the same identity check.

New helper/test logic stays below 400 lines. ChatPage is a pre-existing large
route: only the thin lifecycle wiring changed; no unrelated extraction.
Reload Studio to load the rebuilt browser bundle. No live gateway restart or
model/config change was performed. Existing stranded drafts are not auto-replayed.
