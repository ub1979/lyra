Change / date: Attempt-wide call budgets and profile ceilings (plan revision 6, Slice 4b), 2026-09-18

User problem and reproduction: `agent/turn_context.py` gave every
conversation turn a fresh `IterationBudget(agent.max_iterations)`. Goal-mode
project workers receive judge continuation prompts in the same session (up to
12 Development turns), so a "90-call" worker could spend about 90 calls per
continuation. A per-turn `--max-turns` value alone could not bound an attempt,
and Reusable/Production projects could still queue one whole-application
Development job when no task plan existed (Trial 3's fallback path).

In scope / explicitly deferred:
- Kanban tasks gain `max_agent_iterations` (nullable column, additive
  migration). When set, the dispatcher passes it as `--max-turns` and as
  `HERMES_KANBAN_ATTEMPT_MAX_CALLS` to the worker.
- `agent/attempt_budget.py`: for such a worker, each turn's budget is what
  remains of the attempt; spent calls are counted once per budget object.
  Every other agent keeps the per-turn budget.
- `plugins/ultimate-builder/attempt_ceilings.py`: Development ceilings per
  attempt are Personal 90 (target under 60, measured in live runs), Reusable
  90 per work item, Production 180 per work item. Legacy calls without a
  profile leave the value unset (classic behavior).
- `plugins/ultimate-builder/project_queue_guards.py`: the task-plan rule and the
  Slice 1 preview rule now live in one small module that runs before any
  project mutation. Reusable and Production Development is refused without a
  task graph; Personal and existing Development work are exempt.
- Judge and exhaustion-summary requests are not tool-calling iterations, so
  they do not consume the budget. Reporting them as separate usage lines was
  not added; this remains a gap against the plan's acceptance list.

Impact analysis:
- Only workers whose task carries a ceiling behave differently. Hermes Kanban
  tasks created elsewhere keep NULL and the classic per-turn limit.
- A ceiling above the global 90 is passed as `--max-turns`, so a single turn
  can use the whole attempt budget; the global `agent.max_turns` is unchanged
  for chats and other workers.
- `turn_context.py` still creates the budget in one statement
  (`agent.iteration_budget = IterationBudget(...)`), so the existing preamble
  test that anchors on it keeps its meaning.
- The queue refusal for planned profiles matches the app-it playbook, which
  already says Development follows planning approval and forbids a catch-all
  job. A combined `task-planner,sw-developer` request is refused as a whole,
  with a message to queue planning on its own.
- `project_runs.py` was already about 900 lines before this work. New logic
  went into small modules; `project_runs.py` keeps only thin calls. Splitting
  it further is a separate refactor.

Acceptance criteria: a continuation turn gets exactly the remaining attempt
budget and classic workers keep the per-turn budget (real agent loop);
exhausting the attempt budget records the runtime stop; the column
round-trips, migrates an existing database, and reaches the worker environment
and command; each profile's Development jobs carry the right ceiling; planned
profiles refuse a whole-application job without partial creation; legacy and
non-Development jobs are unchanged.

Affected modules and data: new `agent/attempt_budget.py`,
`plugins/ultimate-builder/attempt_ceilings.py`,
`plugins/ultimate-builder/project_queue_guards.py`; edits to
`agent/turn_context.py`, `hermes_cli/kanban_db.py` (column, migration, create,
spawn), `plugins/ultimate-builder/project_runs.py`, app-it `SKILL.md`. Kanban
schema: new nullable `tasks.max_agent_iterations`.

Tests and observed results: new `tests/agent/test_attempt_budget.py`,
`tests/run_agent/test_attempt_budget_journey.py` (real agent loop and SQLite),
`tests/hermes_cli/test_kanban_attempt_budget.py` (round trip, migration, spawn),
`plugins/ultimate-builder/tests/test_attempt_ceilings.py`. The Slice 3 Reusable
guidance test now supplies a task plan. Wide run (agent, run_agent, builder,
TUI gateway, hermes_cli, dispatcher tick): 19,622 passed, 29 failed, the same
failure set as the pre-change checkout `1e44460c6`. Gateway Kanban suites: 28
passed. Ruff clean.

Compatibility / restart: Restart the gateway so the dispatcher passes the new
budget and workers read it. The column is added automatically on first open.
Downgrading leaves an unused column, which older code ignores.

Rollback / retained recovery data: Revert the commit; the extra column is
harmless to older code.

Local commit / authorized push: local commit only; not pushed.
