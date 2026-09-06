# Per-project Git isolation — 2026-09-06

## Problem and reproduction

Lyra projects stored below `my_projects/` inherited the Lyra application's Git
repository when they did not yet contain their own `.git` directory. Mandatory
project commits therefore advanced Lyra's `main` branch. On another computer,
two TeamGround project commits caused `main` to diverge from the seven Lyra
release commits on GitHub. An ignored directory is not sufficient once files
were already tracked or an agent runs Git from the parent repository.

## Acceptance criteria

- Preparing any Lyra project creates or verifies a Git repository whose root is
  exactly the selected project folder before chat or background work begins.
- A new repository has no remote and receives a marker-only baseline commit;
  existing staged, unstaged, and untracked user work is never swept into it.
- A project inside Lyra's ignored project area cannot proceed while any of its
  files are still tracked by Lyra's parent repository. Explain the one-time
  migration instead of changing the parent index automatically.
- A selected subfolder of an unrelated repository is rejected; users must open
  that repository's root or choose a separate folder.
- Registration and durable phase queuing share one repository policy. Worker
  instructions require project-root Git commands and forbid application-repo
  commits and automatic pushes.
- Real Git tests prove that project commits do not change the parent branch,
  index, status, remotes, or tracked file set. Moving a project preserves its
  repository identity.
- Lyra's normal local commit and push paths reject generated project content,
  including a nested-repository link that was force-added by mistake.

## Boundaries, recovery, and rollout

This change creates only project-local `.git` metadata and `.lyra-project`.
It does not rewrite, reset, stage, commit, or push the Lyra application
repository. It does not migrate already-polluted parent history automatically;
the existing backup/split/reset procedure remains a deliberate one-time repair.
Rollback is the focused Lyra commit. Existing project repositories and commits
remain ordinary local Git data and are not deleted on rollback.

## Verification

Implemented with one focused repository policy module shared by Studio project
registration, the `/ultimate-build` command, and durable project-job dispatch.
The application startup enables repository-local privacy hooks without changing
the configuration of any nested project repository.

Observed for the release candidate:

- 154 Python behavioral tests passed through the canonical isolated test runner,
  including real parent/project Git isolation, preservation of pre-existing
  staged and unstaged work, legacy history refusal, project relocation,
  checkpoint compatibility, and real commit/push hook execution.
- 378 web tests, web type-checking, and the production web build passed.
- Ruff passed for all changed Python source and tests.

Compatibility: restart Lyra once after updating so `start.sh` enables the local
application-repository hooks. Existing projects that are already tracked in an
older Lyra commit require the documented one-time history repair; Lyra refuses
to guess or rewrite that history. Rollback is the focused release commit and
does not remove project-local repositories or commits.
