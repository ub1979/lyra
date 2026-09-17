# Targeted failed-job recovery

Problem: overnight Hello jobs exhausted their iteration allowance. The
coordinator had only whole-project pause/resume/stop; resume deliberately only
unpaused user-paused jobs. Operators had to use Kanban's unblock command.

Acceptance: retry one explicitly selected failed job, with a bounded remaining
work explanation. Do not retry review/input gates, triage, active/finished jobs,
other projects, or dispatch from workers/delegated children. Preserve unfinished
dependencies and the existing recurrence limit. A concurrent newer block must
invalidate the older recovery decision.

Implementation: a small plugin recovery adapter calls the existing unblock API.
The generic storage API gains optional event fencing and an atomic saved recovery
comment for the next worker. No migration or new model tool. Tool and CLI share
the coordinator role gate. Existing callers keep their previous behavior.

Recovery: all prior attempts remain saved; a retry is not completion. Revert
the release commit to remove the new action; saved comments remain valid.
Restart the backend and start a new conversation to load the new tool schema;
do not rebuild toolsets inside an existing cached conversation.

Verification: 8 real-SQLite recovery tests (tool/CLI, isolated projects, worker
role denial, dependencies, review/input refusal, stale-event fencing, rollback);
8 existing tool tests, 30 project-run tests, 11 workflow-contract tests and
8 transaction retry tests passed. All 238 Kanban DB tests passed outside the
sandbox. Inside the sandbox its real-process test failed at the process-ancestry
safety check; no guard was disabled or production code changed to hide that.
Version tests: 9 passed. New adapter: 48 lines; its tests: under 150 lines.
No live Hello jobs were changed. Quota recovery, review acceptance and smaller
work-unit design are separate pending fixes, not solved by adding a retry action.
