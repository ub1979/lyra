Change / date: Call-limit visibility and retry policy (plan revision 6, Slice 4a), 2026-09-18

User problem and reproduction: Trial 3's Development job stopped at 90/90
calls. The runtime already recorded the stop itself: it saved the worker's
final summary as the run handoff (2,727 characters, marked "unverified
handoff, NOT completion") and returned the job to `ready` with one failure.
Studio and the coordinator then showed an ordinary healthy queued job. The
worker had also wasted a call: the low-budget reminder told it to "block with
the remaining work", and the goal-mode rule rejected that `kanban_block`.

In scope / explicitly deferred:
- Retry policy: option A from plan revision 6. The existing breaker already
  gives a project job two attempts (`PROJECT_JOB_MAX_RETRIES = 2`): one
  automatic continuation that receives the saved handoff, then `blocked`. This
  is enforced at the database boundary by `_record_task_failure`; no new
  retry logic was added.
- No model-callable block reason was added; the goal-mode block restriction is
  unchanged.
- `call_limit_state.py` classifies a call-limit stop as `continuing` (ready,
  todo, scheduled or running retry) or `needs_decision` (blocked). Status
  items, the coordinator's status summary and the Project Map show it instead
  of "queued safely" or a generic "needs attention".
- `agent/worker_handoff.py`: in goal mode the low-budget reminder no longer
  advises `kanban_block`; it says the runtime records the stop. The exhaustion
  summary request (now one shared function) asks Kanban workers for a handoff:
  files changed, acceptance items done and open, last test command and result,
  exact next action. Ordinary chats keep the original request.
- The app-it playbook tells the coordinator not to queue a duplicate for a
  `continuing` job and to ask for a smaller named scope before retrying a
  `needs_decision` job. The manual retry path already requires a reason.
- Deferred to Slice 4b: attempt-wide budgets across goal continuations and
  per-profile ceilings.

Impact analysis:
- `_iteration_exhausted()` is unchanged. Its two uses decide broad-task
  replacement and hiding once work units exist; a `ready` exhausted broad task
  is already replaced by the queue logic, so widening it would change
  replacement behavior without need.
- Core runtime changes are gated: the reminder differs only when
  `HERMES_KANBAN_GOAL_MAX_TURNS` is set, and the summary request differs only
  for Kanban workers that are not delegated children. Non-Lyra Kanban users of
  classic (non-goal) tasks see no change.
- The summary request is sent once, at exhaustion, as the last user message,
  so it does not alter the cached prefix of earlier calls.

Acceptance criteria: call-limit stops are classified by job state and other
failures are not; a real queued job that stops once is `continuing`, its retry
context contains the handoff, and a second stop is `blocked` with
`needs_decision`; the Project Map says it stopped at its call limit; the
goal-mode reminder does not advise a block while classic workers keep that
advice; the worker summary request asks for handoff facts and ordinary chats
are unchanged.

Affected modules and data: new `plugins/ultimate-builder/call_limit_state.py`;
edits to `project_runs.py`, `project_progress.py`,
`hermes_cli/project_run_summary.py`, `agent/worker_handoff.py`,
`agent/chat_completion_helpers.py`, app-it `SKILL.md`. No schema change.

Tests and observed results: new `plugins/ultimate-builder/tests/test_call_limit_state.py`
(real SQLite, the runtime's own failure recording) and
`tests/agent/test_worker_handoff_goal_mode.py`. Handoff, finalizer and budget
suites: 42 passed. Agent, run_agent, builder, TUI-gateway and hermes_cli
suites: 19,604 passed, 29 failed; a checkout from before this work
(`1e44460c6`) shows the same 29 failures in the same credential, provider and
service-manager files under the same command, and those files pass when run
alone, so they predate this change. Ruff clean.

Compatibility / restart: Restart the gateway so new workers get the new
reminder and summary request. Existing tasks and their retry counts are
unchanged.

Rollback / retained recovery data: Revert the commit. Saved handoffs and
failure counts are untouched.

Local commit / authorized push: local commit only; not pushed.
