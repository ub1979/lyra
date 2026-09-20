# Studio live-project test preflight

Use this before a real model builds a project. A transport-only CI smoke uses
an isolated echo provider and intentionally needs no job runner; do not confuse
its scope with a full live project journey.

## Establish the environment before starting the clock

1. Record the candidate commit, built asset version, dashboard URL, project
   directory, model/provider, coordinator session and runner state. Preserve
   unrelated working-tree changes. Never write the generated app on Lyra's behalf.
2. Confirm the existing dashboard and gateway belong to the intended install.
   Do not launch a second coordinator for the same project. Do not stop/restart
   a user's active jobs without permission. `start.sh` starts/checks the gateway;
   `hermes dashboard` alone does **not** start the background job dispatcher.
3. For a full-project trial, require a successful runner-health check in the
   same Hermes home/profile used by the dashboard. From the checkout:

   ```sh
   .venv/bin/python -c 'import json,sys; from hermes_cli.kanban_runner_health import job_runner_health; result=job_runner_health(); print(json.dumps(result,indent=2)); sys.exit(0 if result["state"] == "running" else 1)'
   ```

   If unavailable/unknown, classify the environment as not ready. Do not count
   waiting for an absent runner as model latency. Use the existing launcher or
   authorized Studio recovery action, then recheck. Record an intentional
   runner-recovery test separately from a zero-intervention project journey.
4. Use the user's selected model. `glm-5.3-flash:cloud` through local Ollama still
   uses cloud inference; it is not a network-independent performance control.

## Submit once and observe the actual boundary

1. Create a unique project through the normal New Project form. Pick the profile
   and team explicitly. Verify the selected directory (macOS may canonicalize
   `/var` to `/private/var`) before clicking Enter project studio once.
2. A supplied brief should submit automatically. Record the provider request or
   persisted user message, not just a ready label. Never resend to make a failed
   startup look successful. Preserve the failure first; any user recovery is a
   separately labelled continuation.
   With no supplied brief, a new project shows “whats the great idea you wanna
   build” and waits without a model request. A manually chosen preset/custom
   team must remain selected after reload; only “Let Lyra guide me” permits an
   initial recommendation, and confirming a team ends that recommendation step.
3. For an empty conversation, wait for the ready composer placeholder, type the
   message, then check Send is enabled. An empty draft intentionally disables Send.
4. Scope selectors to the labelled surface: `Message Lyra`, `Send message`,
   `Live agents and token usage`, `Project progress map`. Do not use an ambiguous
   `aside` locator. Do not use forced clicks, hidden-terminal keystrokes or APIs
   to substitute for the user path under test.
5. Keep commands short when controlling a test harness through a PTY. A harness
   parsing/selector failure is a test failure, not proof of a Lyra defect. Capture
   outgoing paste/Enter/socket metadata when diagnosing submission, without
   recording credentials or private model reasoning.

## Verify completion, recovery and performance

- Inspect and approve requirements and the actual preview through Studio.
- Confirm one worker per intended phase, correct dependencies and no duplicate
  work after reconnect. Record worker start/end, model-call count and retries.
- Keep user-wait, test-controller failure and active work clocks separate.
  Provider/title/summary calls are not all user submissions; classify them.
- Ask a read-only progress question while a worker runs; confirm useful feedback
  without creating another worker or coordinator edits to worker-owned files.
- Run the app's documented test command **in its project directory**, unpiped,
  retaining its actual exit status. Independently check the real app's acceptance
  criteria, keyboard, errors, reload and narrow layout. Recheck affected behavior
  after QA repairs. A report claiming PASS is not itself proof.
- For Personal QA, compare actual coverage, model calls and elapsed work with the
  calculator baseline (90 calls / 11m12). Fewer calls count as improvement only
  if the required coverage and evidence remain intact. Do not increase limits to
  conceal a repeated per-keystroke test loop.
- Reload after final delivery; check saved replies and absence of new work.
  Distinguish a browser reload from a backend restart durability test.
- Record macOS permission denials. Do not grant Python broad app-management or
  disk access to get a test to pass. Identify the exact denied operation first.

Save observations and commands in a dated report. Separate confirmed product
faults, test errors, environment prerequisites and unresolved hypotheses. Never
declare all of Lyra stable from one small application.
