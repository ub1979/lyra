# Accurate worker spending — 2026-09-16

Change / date: sum every attempt's usage per task, use the canonical token
total in Studio, and save in-flight usage snapshots while a worker runs;
16 September 2026 (follow-up to 0.19.38 after independent review).

User problem and reproduction: the 0.19.38 review found two accounting defects
and one scope gap. (1) `latest_run_usage_by_task` kept only the newest usage row
per task, so a retry that spent 100 tokens after a first attempt of 1,000
displayed 100 rather than 1,100. (2) The Studio total added fresh + cache-read +
output + reasoning, omitting cache-write and double counting reasoning; the
backend's `CanonicalUsage.total_tokens` is fresh + cache-read + cache-write +
output. A 100/200/80/50/20 fixture read 370 instead of 430. (3) Usage was only
written when the worker exited, so a long first attempt showed "Usage not
reported" throughout.

In scope / explicitly deferred: `hermes_cli/kanban_usage.py` replaces the
newest-row reader with `run_usage_totals_by_task`, which keeps the newest
cumulative snapshot of each distinct attempt (keyed by worker session id, then
run id, then event id for legacy rows) and sums them; the payload gains
`attempts`, cost is summed over priced attempts with `cost_status: partial`
when some are unpriced. `record_worker_usage_snapshot` writes a cumulative
snapshot from the agent's session counters at most every two minutes and only
when the call count moved, invoked from `run_agent._touch_activity` beside the
existing Kanban heartbeat bridge. Frontend: `guidedUsageTotal` and
`projectAgentUsageTokens` use the canonical formula; the chat-worker card uses
the same helper; a retried job shows "· N attempts". Deferred: usage for runs
killed before any snapshot (still unknown by design), and displaying completed
jobs individually in the active panel.

Acceptance criteria: two attempts of 1,000 and 100 total 1,100 with
`attempts == 2`; repeated snapshots of one session count once; legacy rows
without a session id group by run id, then by row; snapshots are throttled and
skipped when no new calls happened; every UI token total equals fresh +
cache-read + cache-write + output and excludes reasoning; existing job-card and
panel strings are unchanged for the standard fixture.

Affected modules and data: `hermes_cli/kanban_usage.py`, `run_agent.py` (two
lines in `_touch_activity`), `plugins/ultimate-builder/project_runs.py`,
`web/src/lib/guided-agent-runtime.ts`, `web/src/lib/project-agent-usage.ts`,
`web/src/lib/api.ts`, `web/src/pages/ChatPage.tsx`, rebuilt
`hermes_cli/web_dist`. Existing `usage` event rows are read unchanged; more rows
per worker session are written (one per two minutes at most).

Tests and observed results: `tests/hermes_cli/test_kanban_usage.py` 11 passed
(retry sum, single-session dedupe, legacy grouping, snapshot throttle);
`plugins/ultimate-builder/tests/test_project_runs.py` 29 passed; web typecheck
clean, 421 vitest tests in 52 files passed, lint 0 errors. Live worker journey
still not exercised.

Compatibility / restart: restart Lyra and reload Studio. Workers launched before
the restart report on their next run.

Rollback / retained recovery data: revert the commit; extra snapshot rows are
harmless to the previous reader.

Local commit / authorized push: local commit; push follows the standing
instruction to push each completed change set.
