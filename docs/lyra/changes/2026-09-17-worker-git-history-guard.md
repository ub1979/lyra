# Worker Git history guard

Problem: Hello's TG-012 worker used `commit-tree` without a parent followed by
`update-ref`, replacing main with an unrelated root. It later repaired ancestry;
Hello remains paused and its partial work must not be changed by this fix.

Acceptance: reject worker non-fast-forward updates of existing
local branches, including Git launched from Python. Allow ordinary commits,
initial repositories and new branches. Preserve existing hooks and user Git
configuration. Apply at every durable worker launch (including retries).

Design: a worker-only Git configuration overlay installs reference-transaction
validation at Git's prepared phase, not a shell command regex. Other hooks are
forwarded to their original repository-specific locations. No repository hooks
or config are rewritten. The overlay is inherited by local child processes.
Git hook semantics: https://git-scm.com/docs/githooks#_reference_transaction

Limits: accidental-history-loss protection, not a sandbox. Explicit Git config
overrides, scrubbed environments, remote execution and direct metadata writes
can bypass it. Branch deletion is outside this guard: Git 2.39 reports normal
loose-ref pruning during pack-refs as deletion too, so blanket rejection breaks
maintenance. Deleting then recreating a branch can therefore bypass the guard.
It does not serialize shared files/indexes, protect uncommitted
edits from reset/checkout, or prove Hello complete. Those are separate concerns.

Tests planned: real temporary repositories, parentless update through Python,
rewind, normal commit, initial/new branches, existing hook rejection,
repository isolation, unchanged operator configuration, spawn integration.

Compatibility: workers cannot amend/rebase existing branch history automatically;
intentional history rewrites require the operator outside the worker. Restart
the dispatcher before starting new workers; existing workers are not upgraded.
Rollback: revert code; no repository migration or recovery is needed. Generated
worker hook adapters live with worker logs, contain no secrets, and may be
removed only after their workers exit. Hello remains paused.

Verification so far: 14 real-Git/execute_code regression tests, 9 worker-spawn
tests, 238 Kanban database tests, 143 existing code-execution tests and 9 version
tests passed. The initial sandboxed execution run could not bind local Unix
sockets; the same suites passed outside the sandbox without disabling guards.
Web: 465 tests, typecheck, production build passed; lint has 0 errors and 30
existing warnings. New implementation and regression-test modules are each
under 200 lines. Tested locally on macOS / Git 2.39.5; native Windows runtime
and GitHub CI have not yet been verified for this release.

Implementation findings: a prepared update may report an all-zero old object ID
when the caller omitted the expected value, even for an existing ref. Resolve
that ref under the transaction lock before checking ancestry. execute_code
intentionally scrubs Git environment keys, so carry only the guard back through
the scrub, never inherited Git HTTP credentials. Both have regressions.

Release: 0.19.62. A clean detached candidate checkout passed all 413 scoped
Python tests (7 suites), including the real worker environment and execute_code
journey; no live dispatcher restart/resume was performed. The web version suite
was rerun after final label synchronization (9 passed). File index check,
ruff, Windows-footgun lint and diff checks passed. Remote CI remains a separate
gate; these local results are not a claim that CI or Hello is complete. Hello's
four jobs are still blocked, and its repaired a8c93b8 → 1d9bfb0 → 0d1e5b1
history was checked read-only and left unchanged.
