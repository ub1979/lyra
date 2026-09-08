# Guided chat reattach and worker-runtime reliability — 2026-09-08

## User problem and reproduction

After the dashboard restarted, reopening the saved Hello project reattached to
the still-running keep-alive PTY but left the main composer disabled at
“Preparing the project conversation…”. The PTY continued publishing on its
original event channel while the refreshed browser subscribed on a new channel.
Channel aliasing forwarded future events, but the one-shot `session.info`
readiness event had already passed and was not replayed. A second live
reproduction found that the token documented as per-tab was stored in
`localStorage`, so two open Lyra tabs shared one token and repeatedly superseded
each other's PTY connection. A fresh isolated tab then exposed a startup race:
the already-running gateway can replay `session.info` before the sidecar mirror
WebSocket reaches OPEN, and the client discarded that frame.

Live recovery then exposed a separate process-affinity failure. Kanban workers
were resolved through whichever `hermes` shim appeared first on `PATH`. On this
machine that shim belonged to an older scratch installation with a different
SQLite runtime. The worker switched the same live `state.db` back to WAL while
the gateway and dashboard were using a SQLite release affected by the WAL-reset
corruption bug. A nested `hermes kanban ...` command inside an otherwise-correct
worker could repeat the mismatch because the worker inherited the stale shim at
the front of `PATH`.

## In scope / explicitly deferred

Replay the latest bounded `session.info` frame together with any unanswered
clarification when a browser subscriber reconnects or reattaches through a
channel alias. Store the keep-alive identity in true per-tab `sessionStorage`
so an ordinary reload reattaches but a second tab cannot steal the first tab's
PTY. Preserve the one-conversation PTY and existing prompt replay.
Buffer the bounded startup event burst until the sidecar opens so readiness is
not lost to connection ordering.
Launch workers through the dispatcher's interpreter and prepend that
interpreter's executable directory to the worker `PATH`, so nested Hermes
commands keep the same code and SQLite runtime. An explicit `HERMES_BIN`
operator override remains supported.

## Acceptance criteria

- A refreshed browser receives the original PTY session's latest
  `session.info` and enables the composer without spawning another agent.
- A pending question is replayed after readiness and remains project-scoped.
- `session.closed` removes both replay records.
- One tab reuses its keep-alive token across reloads; separate tabs get separate
  tokens and cannot supersede each other.
- Gateway events emitted before the sidecar reaches OPEN are mirrored in order
  once it connects.
- Worker and nested-worker Hermes commands use the dispatcher's runtime even
  when a stale global shim is earlier on the parent `PATH`.
- Reconnect, PTY keep-alive, prompt replay, web typecheck, and production build
  checks pass.

## Affected modules and data

`hermes_cli/dashboard_prompt_state.py`, `hermes_cli/web_server.py`,
`ui-tui/src/gatewayClient.ts`, the per-tab token helper, and their behavioral
tests. Kanban worker invocation in `hermes_cli/kanban_db.py` and its spawn tests
are also affected. Replay remains in-memory, bounded, and scoped by the opaque
event channel; no durable data or prompt history is added.

## Tests and observed results

- 797 Python dashboard, PTY reconnect, Lyra workflow, and Kanban tests passed.
- All 48 web test files passed (391 tests), with typecheck and lint completing;
  lint reported only the repository's existing warnings.
- The changed TUI gateway-client suite passed (14 tests), plus TUI typecheck,
  lint, and production build.
- The broader TUI suite passed 1,365 tests (4 skipped) apart from three
  unrelated heap-snapshot tests that time out in this host even when run alone
  with a 30-second limit.
- Live loopback browser-transport smoke tests against the running dashboard
  received `session.info`, completed a Hello-workspace message, reattached the
  same session through a new browser channel, and completed a second message.
- A live Stop & retry reproduction interrupted the first turn, emitted an
  interrupted completion, started the retried turn, and completed with the
  expected response.
- The recovered `state.db`, active Kanban DB, scheduler DB, projects DB, and
  verification DB all report `journal_mode=delete` and pass SQLite integrity
  checks under the vulnerable 3.47.1 runtime. Relaunched Hello workers show the
  dispatcher's interpreter and venv first on `PATH`.

## Compatibility / restart

Backward-compatible. The dashboard server, gateway, and tracked web/TUI assets
must be rebuilt/restarted for the fix to take effect. Operators can still use
`HERMES_BIN` when intentionally pinning a worker executable.

## Rollback / retained recovery data

Revert the focused commit. Existing PTY sessions and durable conversations are
unchanged. Operational pre-conversion database copies were retained under
`~/.hermes/backups/`; they are not repository artifacts.

## Local commit / authorized push

Implemented in `73ff6afcf`. The user authorized the combined Lyra 0.19.26
reliability release and push on 2026-09-08.
