# Compact project status

User problem: routine progress display and recovery should not require Lyra or
its workers to repeatedly read a growing narrative progress ledger. Long work
must show a dated, truthful state instead of appearing silently stuck.

Reproduction: a large project accumulates a long `.sdlc/progress.md`; Studio
parses that document for its map and worker prompts instruct agents to read the
whole ledger. A running task may continue without a compact, dated status that
the user can inspect independently of the model conversation.

In scope: add one small atomic `.sdlc/status.json` projection for current
project state; keep detailed history/evidence separate; make Studio prefer the
snapshot with safe legacy fallback; supply workers a compact status-first
recovery contract; preserve date/time and bounded stale/retry presentation.
Notifications, project content, and remote publishing are unchanged.

Acceptance: status writes are atomic and schema-validated; malformed or stale
snapshots cannot create false completion; legacy projects still work; routine
Studio polling reads compact JSON rather than the long ledger; active, waiting,
blocked, and completed state includes an exact update time; workers read detail
only on demand; focused storage, API, UI, recovery, and release tests pass.

Data/security: the snapshot contains status metadata only—no chat transcript,
credentials, prompts, or source content. It remains inside the isolated project
and never enters the Lyra application release.

Compatibility/restart: existing projects gain the snapshot lazily and retain
their Markdown history. A Lyra restart is required after release.

Verification: 213 focused Python storage, project-run, gateway, workflow,
isolation, and release tests pass. All 393 web tests and web type checking pass.
Lint reports no errors (31 pre-existing warnings remain elsewhere). The
production web build, Ruff checks, diff checks, and 7,912-file Lyra index pass.

Rollback: revert the focused release. Existing snapshots are harmless to older
versions and the Markdown ledger remains available.

Local commit / authorized push: pending / authorized by the standing Lyra
release instruction to increment the patch version and push each completed
change set.
