# Current and comparison launchers

Change / date: Current and August 28 comparison launchers / 2026-09-21

User problem and reproduction: Running the current checkout and the August 28
comparison worktree required remembering directories and ports. Starting both
with the default launcher also attempted to use port 9119 twice.

In scope / explicitly deferred: Add a root `old_start.sh` wrapper for the
existing `codex/aug28-ui-brain` worktree, with port 9120 as its default. Keep
`start.sh` unchanged. Installation of a missing comparison worktree remains an
explicit one-time Git command printed by the wrapper.

Acceptance criteria: From the main Lyra folder, `./start.sh` starts current
Lyra on 9119 and `./old_start.sh` starts only the comparison branch on 9120.
Both accept normal dashboard arguments and can run concurrently.

Affected modules and data: Shell launcher and README only. Each checkout keeps
its existing `my_projects` directory. No migration or user-data write is added.

Tests and observed results: `tests/scripts/test_old_start.py` covers the default
comparison port, override, argument forwarding and wrong-branch refusal.

Compatibility / restart: No active process is restarted. The wrapper requires
the existing comparison worktree and Bash, matching the current launcher.

Rollback / retained recovery data: Remove `old_start.sh` and its documentation;
both checkouts and all project data remain untouched.

Local commit / authorized push: Pending local verification; no push requested.
