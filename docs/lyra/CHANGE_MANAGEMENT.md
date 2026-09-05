# Lyra change-management policy

## Before implementation

1. Record the user-visible problem, reproduction, acceptance criteria, affected
   modules, data/security impact and recovery plan in a small change record.
2. Inspect Git status. Preserve unrelated changes and never stage generated user
   projects as part of a Lyra change.
3. Read `AGENTS.md`, the maintenance map, affected source and existing tests.
   Confirm the premise and intended behavior before changing code.
4. Choose the smallest useful module boundary. One cohesive responsibility per
   file; pure policy helpers, narrow state hooks, thin routes and storage adapters.
   No speculative frameworks or mid-conversation prompt changes.

## Implement and verify

- Add a behavioral regression test before, or with, each fix. Do not test source
  text patterns. Comment invariants and non-obvious safety decisions, not every line.
- For filesystem, database, transport or configuration changes, exercise the
  real implementation against temporary fixtures in addition to unit tests.
- Cover cancellation, reconnect, expiry, duplicate input, partial failure,
  old data, denied permission and project isolation where relevant.
- Run Python tests through `scripts/run_tests.sh`. Default discovery includes
  Lyra builder tests. Run web tests/typecheck/lint and rebuild tracked assets.
  Run real Ink tests whenever the PTY/input contract changes.
- Record the exact verification scope and failures. Passing focused checks is
  not proof that the whole repository or generated application is release-ready.
- Update the file map, user-facing instructions and change record together.

## Commit, release and recovery

1. Inspect the final diff for unrelated files, credentials and generated noise.
2. Make a focused **local commit** after verification. A local commit is not
   permission to push or release. Ask for missing authority when needed.
3. Before an authorized push, increment Lyra's patch version exactly once for
   the pushed change set; synchronize changelog, channel, metadata, desktop
   version and generated labels. Leave upstream Hermes versioning independent.
4. Check out a clean release candidate, run its required gates and smoke-test
   restart/resume before describing it as release-ready.
5. Announce restart requirements and compatibility changes. Do not restart a
   user's active jobs without agreement. New structured answer frames require
   the matching rebuilt TUI; reload alone cannot upgrade an existing process.
6. Prefer revert commits for rollback. Back up data before migrations. Never
   use destructive Git resets or discard the user's uncommitted changes.

## Change record template

```text
Change / date:
User problem and reproduction:
In scope / explicitly deferred:
Acceptance criteria:
Affected modules and data:
Tests and observed results:
Compatibility / restart:
Rollback / retained recovery data:
Local commit / authorized push:
```
