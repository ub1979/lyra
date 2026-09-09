# Kanban terminal-tool stop — 2026-09-09

Change / date: Stop a worker turn immediately after its terminal Kanban write,
2026-09-09.

User problem and reproduction: The Hello canary worker for `t_20ae9ccf`
successfully called `kanban_block` at 00:49:14, which ended run 132 and made
the task visibly blocked. The same worker nevertheless continued making model
calls, editing files, running tests, and posting comments until 00:51:05. A
second `kanban_block` then failed because the run was already terminal. The
prompt says to call `kanban_complete` or `kanban_block` and stop, but the agent
loop only used those calls to suppress its missing-terminal-tool nudge; it did
not actually stop after a successful terminal write.

In scope / explicitly deferred: For dispatcher-spawned Kanban workers only,
recognize a successful `kanban_complete` or `kanban_block` result as a terminal
turn boundary. Skip any later calls in the same model batch with paired
non-effect tool results, do not start later batch segments, and exit before
another model request. Failed terminal calls remain recoverable and continue
normally. Do not change manual/orchestrator Kanban calls, board routing,
completion judging, or Hello application behavior.

Acceptance criteria: A successful worker terminal tool is the last side effect
of that worker turn. Every skipped tool call still receives a matching result,
the durable transcript closes with an assistant row, and a rejected terminal
call does not stop recovery. Existing interrupt, segmented execution, and
terminal-nudge behavior remains intact.

Affected modules and data: `agent/kanban_stop.py`, `agent/tool_executor.py`,
`agent/conversation_loop.py`, `agent/turn_context.py`, and focused behavioral
tests. No database schema, project data, or conversation migration.

Tests and observed results: The focused stop, sequential/segmented execution,
and conversation-loop regression set passed 45 tests with one platform skip.
The broader Kanban tools, goals, goal-mode, dispatcher, Studio workflow, and
core agent set passed 903 tests with no failures. Ruff, bytecode compilation,
and `git diff --check` passed. Live restart and the next naturally dispatched
worker remain as the final runtime verification.

Compatibility / restart: Existing worker processes keep their loaded code;
newly spawned workers load the repair automatically. Restart resident chat
processes before testing the same path there. Existing terminal task/run rows
are preserved.

Rollback / retained recovery data: Revert the focused local commit. Existing
Kanban events remain valid and auditable.

Local commit / authorized push: Reliability repair is authorized by the active
monitor. No new push or release is authorized for this follow-up.
