# Coordinator context budget — 2026-09-16

Change / date: bound tool results entering the Studio coordinator's context and
enable Hermes' existing proactive pruning of old tool results for it alone;
16 September 2026.

User problem and reproduction: 52 KB `git diff` and `git status` dumps, 307
file reads and 172 searches accumulated in one coordinator conversation until
every turn compressed for minutes and sent 120k+ tokens. `terminal`'s own 50 KB
cap sits below the 100 KB persistence threshold, and `read_file` is pinned to an
infinite threshold, so nothing in the existing budget system ever fired for the
coordinator.

In scope / explicitly deferred: `tools/budget_config.py` `BudgetConfig` gains
`inline_caps` — hard inline truncation applied before persistence, valid even
for pinned tools because it writes no file and so cannot cause the
persist→read→persist loop the pin guards against.
`tools/tool_result_storage.py` applies it first. New
`tui_gateway/studio_budget.py` defines the coordinator budget (8 KB per result,
32 KB per turn, inline caps for `read_file`/`search_files`) composed with the
context-window scaling by `min()`, and `apply_coordinator_context_policy`, which
sets `agent._studio_coordinator` and turns on
`ContextCompressor.proactive_prune_tokens` (40 % of the window, 2 KB minimum
result) — the pruning Hermes ships disabled. `agent/tool_executor.py`
`_budget_for_agent` routes the marked agent; `tui_gateway/server.py` applies the
policy beside `_force_synchronous_delegation`. Deferred: any change to worker
budgets (the marker is never passed to child constructors) and to the global
`tool_output` config.

Acceptance criteria: the coordinator budget never loosens a small model's
budget; a marked agent gets the coordinator budget and an unmarked one the
default; a pinned `read_file` result is truncated inline for the coordinator and
untouched for a worker; the policy marks only `app-it` sessions and tolerates a
missing compressor.

Affected modules and data: `tools/budget_config.py`,
`tools/tool_result_storage.py`, `tui_gateway/studio_budget.py` (new),
`agent/tool_executor.py`, `tui_gateway/server.py`. No stored data changes.

Tests and observed results: `tests/tui_gateway/test_studio_budget.py` 6 passed;
`tests/tools/test_budget_config.py` and `test_tool_result_storage.py` (+3 each);
`tests/agent/test_proactive_tool_result_pruning.py`,
`tests/run_agent/test_tool_call_incremental_persistence.py`,
`tests/test_tui_gateway_server.py` — 593 passed together.

Compatibility / restart: restart Lyra. Existing oversized history is pruned by
the compressor from the coordinator's next turn; nothing is deleted from the
saved transcript.

Rollback / retained recovery data: revert the commit; `inline_caps` defaults
empty so the budget system is byte-identical without the coordinator marker.

Local commit / authorized push: local commit; push follows the standing release
instruction.
