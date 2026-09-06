# Studio model selection survives retry

The main AI selector shows Claude Opus while a resumed Studio conversation
restores a saved GLM model. A session override prevents the existing config
synchronization from correcting it. The v0.19.20 job repair also rejects the
mandatory Requirements member because it is not a background phase.

Scope: Studio coordinator startup and turn synchronization, whole-team routing
validation, and truthful live-model display. Preserve ordinary TUI/desktop
session model pins and all project history. No guessed replacement models.

Acceptance: a saved GLM conversation with Claude Opus selected constructs and
retries with the selected Claude model/provider; failed switching does not call
the old model; whole-team repair reaches real SQLite jobs; ordinary session
pins remain intact. Verify the actual CLI command model as well as UI state.

Verification:

- Saved-session regression uses the real provider resolver, a temporary profile
  config, and an executable CLI fixture. Both resume attempts pass
  `claude-opus-4-6` to the subprocess despite a saved and environment-seeded GLM
  model. No paid model request is made.
- Eager/deferred resume RPC tests verify the Studio skill identity survives;
  live synchronization and failure-retention tests cover retry without an old
  model call. Ordinary session pins and worker routing remain independent.
- Whole-team API test repairs a real SQLite job with Requirements included.
- Broader gateway run: 608 passed, 2 alias expectations failed. Both failures
  reproduce on unchanged v0.19.20 (expect Anthropic, receive Claude CLI).
- Embedded-chat suite: 1,364 passed, 4 skipped, 3 memory-dump tests timed out in
  the isolated worktree; these tests pass in the main checkout. Targeted
  lifecycle tests, embedded-chat typecheck/lint/build passed.
- Final focused Python release run: 191 passed, including the complete builder
  suite, resume RPC paths, failure retention, and version consistency.
- Studio web suite: all 385 tests, lint, typecheck and production build passed.

Restart required for both the backend and rebuilt embedded chat. Revert the
focused release commit for rollback; no project data migration.
