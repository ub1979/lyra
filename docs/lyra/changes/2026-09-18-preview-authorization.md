Change / date: Backend-owned preview authorization (plan revision 6, Slice 1), 2026-09-18

User problem and reproduction: In Trial 3 (session `20260918_211649_951593`)
the user typed "approve" for requirements. In the same turn the coordinator
wrote the preview, queued Development two seconds later and told the user
"Preview approved". Nothing in `queue_project_run` checked for a preview
decision, and the app-it playbook let "smart defaults" stand in for checkpoint
approval.

In scope / explicitly deferred:
- New `project_run` action `preview` opens a checkpoint. The backend writes the
  question and choices and records a digest of `.sdlc/preview/`.
- The coordinator presents that exact question through the existing `clarify`
  tool. Button answers and typed composer answers both arrive as the clarify
  result, which comes from the gateway, not from the model.
- A `post_tool_call` plugin hook records the user's answer only when the
  clarify question matches the open checkpoint for the same session.
- `queue_project_run` refuses the first Development job of a workspace unless
  the latest checkpoint is approved for the current digest or skipped.
- Records live under `<HERMES_HOME>/app-state/`, which the agent's file tools
  can no longer write, like `state.db` and `sessions/`.
- Deviation from the plan: a project without preview files is not skipped
  automatically. The backend asks the user whether to build without a preview,
  because the backend cannot tell a UI project from a non-UI one, and an
  automatic skip would reopen the Trial 3 bypass (just never write a preview).
  This costs non-UI projects one extra click.
- Deferred: a Studio-specific checkpoint card. The existing clarify card is
  used unchanged.

Impact analysis (who else is affected):
- Queue callers: only the `project_run` tool and the `hermes project-run` CLI
  queue jobs; the dashboard never queues. Both go through
  `queue_project_run`, so both are gated.
- Existing projects: any workspace that already has a Development task (any
  status, including archived) is exempt, so running, resumed, retried and
  repair work is unaffected. Later phases (QA, review, debugging) are not gated.
- Workers and delegated children still cannot call `project_run` at all.
- File-tool deny list: `app-state/` is a new directory, so no existing file
  write changes behavior. Terminal commands are not sandboxed; this is an
  application boundary, not an OS sandbox, matching the rest of the file-safety
  design.
- Tests that queue Development directly now record an explicit approval first,
  through the real checkpoint API.
- Prompt caching: no system-prompt change; the playbook text changes only when
  the skill is next loaded.

Acceptance criteria: Button approve, typed approve and typed skip after the
checkpoint permit queueing. Refused: no checkpoint, "Change", unclear text, a
preview changed after approval, a different session, a stale question, a
model-written file, and a CLI call without a decision. The Trial 3 sequence
(requirements approval, preview written, queue in the same turn) is refused.

Affected modules and data: `plugins/ultimate-builder/preview_*.py` (new),
`project_run_tool.py`, `project_runs.py` (one guard call), `__init__.py` (hook
registration), app-it `SKILL.md`, `agent/file_safety.py`. New JSON records
under `<HERMES_HOME>/app-state/ultimate-builder/preview-checkpoints/`.

Tests and observed results: new `test_preview_authorization.py` (digest,
answer classification, checkpoint lifecycle, real clarify tool plus plugin
hook, the Trial 3 queue sequence, tool and CLI parity, exemptions, hook
registration) and `test_file_safety_app_state.py` (real `write_file` tool).
Twelve existing queue tests now record a user decision through the real API
first. Builder, kanban, TUI-gateway, skills, file-safety, clarify and plugin
suites: 2,022 + 476 + 237 tests passed, 0 failed. Ruff clean. Not yet verified
in a live Studio journey.

Compatibility / restart: Restart the dashboard/gateway so the plugin hook and
new tool action load. An old coordinator conversation that tries to queue
Development without a checkpoint gets a plain refusal telling it to present
the preview.

Rollback / retained recovery data: Revert the commit. Checkpoint records are
additive and ignored by older code.

Local commit / authorized push: local commit only; not pushed.
# Independent verification follow-up

Preview hashing now rejects more than 200 files and symlinked preview content
instead of silently approving a partial digest. Real checkpoint/filesystem
tests cover both refusal paths. Queue tests now isolate approval storage in a
temporary profile instead of the real user home. See
`2026-09-18-revision6-verification-followup.md` for results and limitations.
