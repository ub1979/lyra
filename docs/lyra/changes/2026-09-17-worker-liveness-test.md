# Test the production worker-liveness contract on macOS

Problem: the worker SIGTERM test copied a Linux-only zombie detector; on macOS
it reported an exited child as alive although the production dispatcher did not.
Scope: remove the incomplete copy and use the actual dispatcher liveness helper.
Keep real subprocess termination timing, non-daemon-thread contrast and handler
checks. No production worker termination change or relaxed timeout.
Acceptance: worker exits within the original bound; real helper recognizes it;
non-worker contrast remains covered. Run with live-system guard enabled.
Verification: 22 worker-signal/stop/workflow tests passed, including real Git,
SQLite and temporary processes. Studio browser smoke passed: two turns, token
display and cold reload (9.5 seconds test time). It uses an echo provider, not a
real-provider soak; packaged first-run connect remains a separate validation gap.
Compatibility: test-only; no data/runtime changes. Revert to roll back.
User authorized separate version/commit/push per fix.
