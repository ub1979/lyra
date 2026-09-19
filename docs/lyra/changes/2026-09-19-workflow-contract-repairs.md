# Calculator-trial workflow contract repairs

Status: steps 1–4 implemented and checked locally; no release or live-journey claim.
User approved steps 1–4 of the synthesis and explicitly reserved step 5 for
their own testing. Do not start a live project acceptance journey.

Scope: capability-compatible verification; one trusted preview decision and
worker handoff; proportional Personal documentation; installed skill resources;
real test-command evidence; one-shot cron outcome; truthful Studio state.
No scheduler replacement, skill truncation, budget increase or prompt mutation.

Reproduction/evidence: `../2026-09-19-calculator-live-trial.md` and
`../2026-09-19-reliability-synthesis-and-action-plan.md`.

Impact boundaries: preserve ordinary CLI/worker verification, existing preview
authorization/digest fencing, richer/legacy profiles, user-modified skills,
cron claim semantics and separate coordinator/worker usage. New logic belongs
in focused modules; large existing entry points receive thin integration only.

Verification: targeted behavioral regressions and real temporary stores; then
affected Python/web suites. Actual end-to-end journeys are deliberately deferred.
Record precise results below before committing. Rollback: focused revert commits;
keep saved project/checkpoint data, no destructive migrations. No active service
restart or push is authorized by this record.

Model: requested `qwen3.5:9b-mlx` is advertised by local Ollama with tool support,
local safetensors weights, and no remote-host metadata. Selecting it changes the
model as well as network dependence; do not claim an apples-to-apples speed test.

## Results and boundaries

- Saved main default is now `qwen3.5:9b-mlx`, provider `ollama-local`, endpoint
  `http://127.0.0.1:11434/v1`. Added Qwen to the provider's model list while
  preserving existing entries. The server advertises 262,144 context tokens.
  No model generation or live project trial was run. Explicit per-agent choices
  in an existing browser/project are not silently overwritten: select Qwen or
  inherit the project default when doing the local-only trial.
- Broad affected run: **1,191 passed, 24 failed** across 65 Python files.
  An unchanged-HEAD worktree reproduced all 24 failures across the same five
  cron files (742 passed in that 34-file baseline). Failures involve profile
  database/logging isolation and the test live-process signal guard; do not
  call the broad suite green. Baseline log retained at
  `/private/tmp/lyra-contract-baseline-tests.log`.
- Subsequent focused run: **92 passed** across nine files, including the real
  restricted-agent loop and real Node/cron execution paths. An extra regression
  then checks preview alternatives against the clarify tool's button limit;
  all **36 preview tests** passed on that rerun.
- Final combined affected regression set: **473 passed / 0 failed** across
  32 files after the final instruction and handoff corrections. Log retained at
  `/private/tmp/lyra-contract-focused-final.log`.
- Web: **487 passed**, typecheck clean, lint **0 errors / 30 warnings**.
  Production bundle rebuilt; the existing large-bundle warning remains.
  Python focused Ruff checks and explicit Windows-footgun checks passed.
- No broad refactor: new code modules are under 400 lines. Existing large
  conversation loop, coding context, task-body and ChatPage files received thin
  integration changes; they have not been made compliant with a 400-line limit.
- Generic no-terminal verification reports unverified work honestly; it does
  not manufacture passing evidence. Coordinator cron exclusion is role policy,
  not a security sandbox. Worker and ordinary CLI verification remain enabled.
- Skill resources use existing package ownership and sync protections, not a
  new dependency manager. Personal uses the full Technical Writer skill's
  Specific doc mode; it does not bypass documentation verification.
- Judge/summary accounting is disclosed as excluded, not claimed fixed.
  Earlier SQLite I/O root cause, managed-service recovery and Production graph
  acceptance remain unresolved/unverified as recorded in the plan.
- Step 5 deliberately NOT run: the user will perform live acceptance. No
  service restart, push or version bump in this work.

## Local implementation commits

- `fb28822ae`: capability-compatible finish verification and coordinator role.
- `69b31cd08`: trusted preview selection, setup alignment and Personal handoff.
- `bb32513a9`: existing skill resource ownership and installed-path regression.
- `49f8bcd59`: manifest-free Node verification evidence.
- `3c4579f1f`: exact cron execution outcome.
- `70dee80c3`: truthful coordinator state and unknown usage.

Generated Studio assets and maintenance inventory are recorded separately after
the source commits. No version bump because this is not a pushed release.

## User-run acceptance preparation

When existing work is idle, restart Lyra to load the new Python code and reload
Studio. Use a fresh Personal project/conversation. The main default is Qwen;
check agent assignments also inherit Qwen or explicitly select it, since saved
project/browser overrides deliberately survive a default-model change.
Confirm the actual session/worker model in the UI/logs during your trial. No
claim is made that a default change switched already running agent instances.
