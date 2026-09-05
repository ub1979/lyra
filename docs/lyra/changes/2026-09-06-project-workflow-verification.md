# Project workflow verification — 2026-09-06

## Problem and scope

Repeated approval/worker/status failures require cross-component evidence, not
another claim that isolated unit tests prove the complete product reliable.
Exercise an isolated project through a pending question, subscriber reconnect,
answer, durable queue, real subprocess dispatch, completion and notification.
Include failed notification delivery, duplicate approval and project isolation.

## Acceptance and boundaries

- Use real gateway prompt handlers, dashboard event handlers, SQLite storage,
  dispatcher/spawner and notification poller.
- Replace only external boundaries: the browser socket and AI work. A controlled
  subprocess must write evidence, commit it locally, heartbeat and complete its
  leased job. This is integration coverage, not a live-model/browser E2E claim.
- Never restart or modify the user's live Hello project or gateway.
- Keep fixtures temporary; no credentials, network providers or remote pushes.

## Verification

- New integrated lifecycle: 2/2 passed (normal delivery and injected dispatch
  failure followed by retry). Both run approval/reconnect, duplicate-safe queue,
  real worker PID/heartbeat, committed evidence, offline completion, wrong-chat
  exclusion, resumed notification, real coordinator turn/stream/final event and
  retained conversation history. A second notification claim finds no duplicate.
- Existing prompt protocol, dashboard replay and project-run/progress suites:
  121 passed.
- Failed-turn retention and crash auto-continuation suites: 27 passed.
- Complete Studio web suite: 370 passed.
- Real Ink structured-answer transport: 3 passed.
- Python lint and formatting checked. No runtime source or generated assets
  changed; no rebuild required for this test-only change set.

These are 523 passing checks, not a guarantee of uninterrupted service. No
live-provider inference, rendered-browser E2E, actual browser authentication,
multi-hour soak or hard process kill inside the notification claim window was
tested. The socket/auth boundary is substituted and the AI work is controlled.
The production coordinator turn path is exercised through final streaming/event
delivery; the controlled model writes its response to the real session database.

## Change/recovery

Test-only changes and maintenance navigation. No runtime restart or data
migration required. Local commit only; no release/version bump or push.
