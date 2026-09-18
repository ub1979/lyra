Change / date: Worker ledger template and repeatable test contract (plan revision 6, Slice 3), 2026-09-18

User problem and reproduction: Trial 3's Development worker (session
`20260918_212750_eb0f61`) ran out of its 90 calls. It spent 12 calls searching
Lyra's source and an older project to learn the `.sdlc/progress.md` format,
because the job said "update the ledger" without showing the format and the
project had no ledger yet. It spent 46 calls driving a browser-only test page
through navigation and console reads, because nothing asked for a repeatable
terminal test command.

In scope / explicitly deferred:
- `progress_ledger_seed.py` holds the only copy of the ledger template, the
  example row and the status words the parser reads. `queue_project_run`
  creates `.sdlc/progress.md` from it when missing, before any worker starts.
- `worker_guidance.py` renders three blocks appended to job instructions:
  the ledger format (every phase job), the testing contract (Development,
  Debugging, QA and Code review), and a lean Personal procedure (Development
  with the Personal profile only).
- The testing contract asks for one repeatable terminal command with a
  reliable exit status, recorded in the Project Brain, rerun after every
  repair, never piped through `tail`/`head`/`tee`/`|| true`. Dependency-free
  projects default to Node's built-in `node --test` for logic modules. The
  browser is for real user journeys, repeated when a defect warrants it, not
  for individual assertions.
- The selected profile now reaches the Development job body.
- Deferred: asking the Requirements phase to name the test command. The
  Development worker names it and records it in the Project Brain instead.
  Whether the Personal block explains Trial 3's browser-only test choice is
  still an inference; the next live journey measures it.

Impact analysis:
- Job bodies grow by roughly 1,000 characters. They are per-task worker
  prompts, so the coordinator's prompt cache is unaffected.
- Seeding writes one new file in the user's project only when it is missing,
  with `O_EXCL` so a worker that creates it at the same moment wins, and never
  through a symlinked `.sdlc`. The status snapshot rebuilds from it as before.
- Reusable and Production keep their procedure; they only gain the ledger and
  testing blocks. Documentation, research and design jobs get only the ledger
  format.
- The developer and frontend playbooks were checked for conflicting browser
  testing rules; the developer playbook already asks only for a quick browser
  smoke path.
- Existing tasks keep their saved bodies; the new text applies to newly
  created jobs.

Acceptance criteria: the seeded template plus the example row parses into a
running Development phase; every documented status word maps to a distinct
parser state; the ledger is created once, never overwritten, never written
through a symlink; a Personal Development job carries all three blocks; a
Reusable one carries no Personal block; a documentation job carries the ledger
format but no testing contract.

Affected modules and data: new `plugins/ultimate-builder/progress_ledger_seed.py`
and `worker_guidance.py`; `project_runs.py` (body wiring, a small module
loader, ledger seeding call). New file `.sdlc/progress.md` in projects that
lack one.

Tests and observed results: new `plugins/ultimate-builder/tests/test_worker_guidance.py`
(real parser, real queue and SQLite task bodies). Builder, kanban and
TUI-gateway suites: 211 passed. TUI gateway, skills, skill integrity, web
server and gateway-server suites: 2,004 passed. Ruff clean. Not yet measured in
a live journey.

Compatibility / restart: Restart the dashboard/gateway so new jobs use the new
instructions. No data migration.

Rollback / retained recovery data: Revert the commit. Seeded ledgers are
ordinary project files and remain valid.

Local commit / authorized push: local commit only; not pushed.
