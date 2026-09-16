# Notification busy-state ownership — 2026-09-16

Change / date: release the Studio session's busy flag whenever a durable
notification delivery claim is rejected or fails; 16 September 2026.

User problem and reproduction: Studio said "Lyra is working" indefinitely while
no model request ran and no tokens moved. `output/lyra-notification-repro-2026-09-16.py`
reproduces it against a temporary `HERMES_HOME`: an already-delivered
`async_delegation` completion is polled again, `claim_event_delivery` returns
`None`, and the poller `continue`s after having already set
`session["running"] = True`. The flag is only ever cleared inside
`_run_prompt_submit`, which never started. Before this change the script printed
`running_after_duplicate: True`.

In scope / explicitly deferred: the three delivery sites in
`tui_gateway/server.py` (live poller loop, shutdown drain, post-turn drain) now
go through one helper, `tui_gateway/notification_turn.py`, that marks the
session busy and claims delivery as a single step and releases the busy flag
when the claim returns `None` or raises. Requeue policy stays with each caller.
Deferred: the shutdown drain still lacks the `kanban_task` rewind that the live
loop performs on dispatch failure (pre-existing asymmetry, unchanged here), and
provider-quota handling (audit item LYR-02).

Acceptance criteria: a rejected or failed claim leaves `session["running"]`
False, emits no `message.start`, and never calls `_run_prompt_submit`; a busy
session is reported to the caller untouched; an accepted claim (including the
valid empty-string token for non-delegation events) proceeds exactly as before;
the reproduction script prints `running_after_duplicate: False`.

Affected modules and data: `tui_gateway/notification_turn.py` (new),
`tui_gateway/server.py` (three call sites). No database schema, session files or
project data change.

Tests and observed results: `tests/tui_gateway/test_notification_turn.py`
(5 passed) and `tests/tui_gateway/test_notification_busy_state.py` (3 passed,
real SQLite claims through `_notification_poller_loop`); existing
`tests/test_tui_gateway_server.py` and `tests/tui_gateway/test_lyra_project_workflow.py`
474 passed. Reproduction script now prints `running_after_duplicate: False`,
`model_started: False`.

Compatibility / restart: restart Lyra to load the gateway change. No Studio
rebuild needed for this item alone.

Rollback / retained recovery data: revert the commit; no stored data is altered.

Local commit / authorized push: local commit; no push requested.
