# Turn-free job updates — 2026-09-16

Change / date: deliver re-queued failures and stale block notifications to the
Studio chat as one quiet line without a model turn, and shorten the internal
notification envelope; 16 September 2026.

User problem and reproduction: every durable job event started a full
coordinator turn; one project chat received 159 such turns. On 16 September a
stale `blocked` update for an old task started a turn the moment the project was
opened, forcing a 2 m 28 s compression and ending in an empty reply.

In scope / explicitly deferred: new `tui_gateway/notification_policy.py`
`notification_requires_turn(evt)` decides on `(event_kind, task_status,
attention_kind)`: a finished phase (the phase-advance mechanism) or a job still
waiting on a decision starts a turn; `crashed`/`timed_out` (retry already
queued) and a `blocked`/`gave_up` event whose task is no longer blocked or in
triage do not. The poller emits `status.update` with `kind: project_job`
instead; the browser renders it as one plain assistant line via
`web/src/lib/guided-job-notice.ts` (same pattern as clarification lines). The
claim already advanced the durable cursor, so nothing is re-offered. The
`kanban_task` event carries `event_at`; the internal envelope in
`hermes_cli/project_job_attention.py` is about half its previous length and
points the model at `project_run status`. Deferred: coalescing a backlog into
one notice on project open (LYR-05 follow-up) and persisting the quiet line to
the durable transcript.

Acceptance criteria: a `timed_out` event produces one `project_job` frame, no
`message.start`, no prompt, and leaves the session idle; a live `blocked` with
`attention_kind` and a `completed` event still start a turn; the existing
approval → worker → resumed chat journey passes for both completion and review;
the same notice id is stable so replays do not duplicate the line.

Affected modules and data: `tui_gateway/notification_policy.py` (new),
`tui_gateway/server.py` (kanban branch, `event_at`),
`hermes_cli/project_job_attention.py`, `web/src/lib/guided-job-notice.ts`
(new), `web/src/pages/ChatPage.tsx`, rebuilt `hermes_cli/web_dist`. No stored
data changes.

Tests and observed results: `tests/tui_gateway/test_notification_policy.py` 17
passed; `tests/tui_gateway/test_notification_turn_free.py` 3 passed;
`tests/hermes_cli/test_project_job_attention.py` 13 passed;
`tests/tui_gateway/test_lyra_project_workflow.py` and
`tests/test_tui_gateway_server.py` — 510 passed together; web
`guided-job-notice.test.ts` 3 passed, full web check 424 tests, typecheck
clean, lint 0 errors.

Compatibility / restart: restart Lyra and reload Studio (web bundle rebuilt).
Older browsers ignore the new frame kind, as they did `process` frames.

Rollback / retained recovery data: revert the commit.

Local commit / authorized push: local commit; push follows the standing release
instruction.
