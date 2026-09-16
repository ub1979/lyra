# Coordinator guarantees hold end to end — 2026-09-16

Change / date: make the two 0.19.40 promises true across every stage — the
Project Brain is never truncated by the aggregate turn budget, and a worker
cannot queue or control project jobs through any path; 16 September 2026
(follow-up to independent review of 0.19.40).

User problem and reproduction: (1) `read_file` allowed 24 KB per result, but
`enforce_turn_budget` then replaced the largest result in the turn regardless of
tool: a 16,200-character Brain plus three 6,000-character results shrank the
Brain to a 1,583-character preview. (2) `check_fn` hid `project_run` from a
worker's schema, but the handler and `queue_project_run` accepted a
worker-originated call; with `HERMES_KANBAN_TASK` set, a task was created.
Separately, the prune trigger at 40 % of the window meant 400k tokens on a
million-token model.

In scope / explicitly deferred: `enforce_turn_budget` skips results whose tool
has an inline cap in the active budget (they were admitted whole on purpose);
uncapped results are bounded exactly as before. `project_runs.py` gains
`dispatch_blocked_reason()` — one gate for the CLI and the tool — and
`queue_project_run` / `control_project_run` raise `PermissionError` inside a
worker or delegated child; `project_run_tool` refuses non-status actions with a
JSON error and derives `coordinator_only()` from the same function. The prune
trigger is capped at 100k tokens. Deferred: shell access inside workers remains
(the gate prevents accidental recursion, it is not a sandbox), and status reads
stay allowed everywhere.

Acceptance criteria: a 16.2 KB Brain survives per-result and aggregate stages in
the same turn while uncapped siblings are still bounded; a worker's queue,
pause and control calls fail through both the tool handler and
`queue_project_run` without creating a task; status still works for a worker;
the coordinator path is unchanged; prune threshold is 100k on a 1M window and
unchanged on 128k.

Affected modules and data: `tools/tool_result_storage.py`,
`plugins/ultimate-builder/project_runs.py`,
`plugins/ultimate-builder/project_run_tool.py`, `tui_gateway/studio_budget.py`.
No stored data changes.

Tests and observed results: `tests/tui_gateway/test_studio_budget.py` (+2:
combined stages, prune cap), `tests/tools/test_tool_result_storage.py` (+2),
`plugins/ultimate-builder/tests/test_project_run_tool.py` (+1 worker refusal),
`plugins/ultimate-builder/tests/test_project_runs.py` (+1 shared gate); plugin,
`tests/tui_gateway`, budget and persistence suites pass together.

Compatibility / restart: restart Lyra. A worker that previously relied on
`hermes project-run queue` from inside a job now receives a clear refusal; no
shipped playbook instructs that.

Rollback / retained recovery data: revert the commit.

Local commit / authorized push: local commit; push follows the standing release
instruction.
