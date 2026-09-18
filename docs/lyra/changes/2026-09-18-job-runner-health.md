Change / date: Job runner health and user-triggered start (plan revision 6, Slice 2), 2026-09-18

User problem and reproduction: In Trial 3 the Development job stayed `ready`
because no dispatcher was running. `project_run` status said nothing was
wrong, and the coordinator told the user the job would start shortly and that
it had "nudged the scheduler". The user's own gateway had exited at 16:56 on
an unexpected signal.

Root cause of the dead gateway: `start.sh` starts the gateway as a child of the
launcher (`gateway run --replace --external-supervisor`) and stops it in its
EXIT/INT/TERM trap. The gateway therefore lives only as long as the launcher,
and nothing restarts it; no LaunchAgent was ever installed. `start.sh` also
decided readiness with `_check_dispatcher_presence`, which reports healthy when
its own probe fails.

In scope / explicitly deferred:
- `hermes_cli/kanban_dispatcher_tick.py`: the embedded dispatcher writes a
  small tick record (pid, time, interval) at the top of every loop iteration.
  Only the process that passed the singleton-lock gate runs that loop.
- `hermes_cli/kanban_runner_health.py`: `running` (fresh tick from a live
  process), `unavailable` (dispatch off, or no gateway and no fresh tick) or
  `unknown` (live gateway without a fresh tick, or the check failed). The
  check never takes the dispatcher lock: a checker holding it for a moment
  would make a starting gateway see it as contended and never dispatch.
- `project_run` queue, status and pause/resume/stop results include
  `job_runner`. The app-it playbook and Studio's per-turn routing text tell the
  coordinator not to promise a start when it is not `running`.
- Studio's Agent activity panel shows a notice when saved jobs are waiting and
  the runner is not `running`, with a **Start job runner** button. The button
  calls the existing `/api/gateway/start`, which runs `hermes gateway start`;
  on macOS that installs or repairs the per-user LaunchAgent (KeepAlive) and
  kickstarts it. No dispatcher is added to the dashboard. The notice clears
  only when a fresh tick reports `running`, and reports failure after 90 s.
- `start.sh` uses the strict health check and waits up to 60 s for the first
  tick. It still starts a launcher-owned gateway, because installing a login
  service without the user's action would be a system change they did not
  ask for.
- Deferred: installing the LaunchAgent automatically from `start.sh`.

Impact analysis:
- Dispatcher loop: one small atomic file write per interval, inline, so the
  loop's thread usage is unchanged (an existing test counts it). A failed
  write is logged at debug level and never stops dispatching.
- Older gateways that do not write ticks show as `unknown` until restarted,
  never as `running`. `start.sh` may then start a replacement with its
  existing `--replace` takeover.
- `project_run_state` is polled by the dashboard; the added check is one small
  file read, one `os.kill(pid, 0)` and a config read.
- `_check_dispatcher_presence` is unchanged for its existing callers
  (`hermes kanban create` warnings).
- Studio: new optional field `job_runner`; older backends omit it and the
  notice stays hidden.

Acceptance criteria: probe failure reports `unknown`, never `running`; no
gateway and no tick reports `unavailable`; a fresh tick from a live process
reports `running`; a live gateway without ticks reports `unknown`; dispatch
turned off reports `unavailable`; the real dispatcher loop writes a tick that
the health check reads as `running`; the coordinator-facing results carry the
state; Studio offers the start action only while jobs wait and the runner is
not `running`.

Affected modules and data: new `hermes_cli/kanban_dispatcher_tick.py`,
`hermes_cli/kanban_runner_health.py`, `web/src/lib/job-runner-notice.ts`,
`web/src/components/JobRunnerNotice.tsx`; edits to
`gateway/kanban_watchers.py`, `plugins/ultimate-builder/project_runs.py`,
`web/src/lib/api.ts`, `web/src/pages/ChatPage.tsx` (one render line),
`web/src/lib/guided-agent-routing.ts`, app-it `SKILL.md`, `start.sh`, rebuilt
`hermes_cli/web_dist`. New file `<kanban home>/kanban/.dispatcher-tick.json`.

Tests and observed results: new `tests/hermes_cli/test_kanban_runner_health.py`,
`tests/gateway/test_kanban_dispatcher_tick.py` (real watcher loop),
`plugins/ultimate-builder/tests/test_project_job_runner.py`,
`web/src/lib/job-runner-notice.test.ts`,
`web/src/components/JobRunnerNotice.test.tsx`. Builder and kanban suites: 186
passed. Gateway/hermes_cli kanban, gateway and dispatch suites: 12,485 passed,
8 failed; the same 8 fail on a clean checkout of the previous commit (WeCom,
systemd socket, WSL, media routing, shutdown forensics on macOS), so they
predate this change. Web: typecheck clean, 483 tests passed, ESLint clean on
changed files, production build succeeded. Not yet verified in a live Studio
journey or with a real LaunchAgent start.

Compatibility / restart: Restart the gateway to start writing ticks, and reload
Studio for the new panel. Until the gateway restarts, health shows `unknown`.

Rollback / retained recovery data: Revert the commit. The tick file is
ignored by older code.

Local commit / authorized push: local commit only; not pushed.
