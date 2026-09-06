# Visible review handoff — 2026-09-06

## Reproduction and scope

Hello's raw `hermes kanban create` development job finished its foundation work
and blocked with `review-required:` at 00:57 BST. It had no notify subscription.
The structured create tool already subscribed, but the CLI bypassed that code.
The dashboard had been running since before the generic-job visibility fix.
Technical review was delegated to the user without an explanation or action.

## Acceptance criteria

- CLI and model-tool creation share existing opt-in/gated origin subscription
  behavior, including retry, correct chat/profile and no unattached-CLI delivery.
- A blocked review is visible beside the Studio composer even with sidebars
  hidden and no delivered chat event. Show a plain-language explanation and an
  explicit action through the existing chat, never automatic user approval.
- Notifications identify the actual saved job/reason for the coordinator;
  distinguish technical review from a user decision and preserve project scope.
- Reproduce raw CLI → worker → blocked review → notification/reconnect, not just
  canonical phase creation. Test disabled/stale UI actions and stored reasons.
- Repair Hello's missing subscription without completing, approving, reassigning
  or restarting its work. Activate updated runtime only when no jobs/turns run.

## Modules / impact / rollback

Extract existing Kanban notification policy into a shared CLI module. Extend
the current gateway notification and Studio supporting panels, not the core
agent loop or transcript. No new model tools, schema migration, provider changes
or mid-conversation prompt rewrite. Existing notification preference remains.
Local commit only; no push/version release. Revert the focused commit to roll
back; preserve saved task events, conversation and project commits.

## Results

- Focused backend regression: 157 passed across CLI/tool/phase creation,
  attention metadata, project progress, prompt replay and real workflow tests.
  The original combined run passed 155; two additional phase-reuse/opt-out
  cases then passed with all ten phase tests. All used the canonical runner
  with `--file-retries 0`.
- Web suite: 378 passed (49 files). Real Ink clarification transport: 3 passed.
  Python lint and diff checks passed. Web typecheck/production build passed;
  lint has no errors and 30 existing warnings. Build retains the large-chunk
  warning. Rebuilt tracked dashboard assets.
- Workflow regression exercises both canonical phase and raw CLI creation,
  real SQLite/Git, dispatcher subprocess, worker review block, reconnect and
  notification retry through a final coordinator response. Model and socket
  boundaries are controlled in this automated test. Four extra consecutive
  runs passed without retries. An earlier run had one intermittent workflow
  failure that passed on retry; subsequent repeated success does not prove
  absence of all timing failures.
- Broader gateway suite: 467 passed, two startup-provider tests failed
  (`test_startup_runtime_resolves_short_alias_without_network` and
  `test_startup_runtime_does_not_call_network_detector`). They expect
  Anthropic for a short alias but resolve Claude CLI. The startup resolver is
  unchanged versus HEAD; this work does not modify provider selection. Do not
  describe the whole repository as globally green.

## Actual Hello recovery

Verified no worker or chat turn was running before stopping the old dashboard
and its launcher-owned gateway. Added the missing TUI notification subscription
for the exact existing foundation job and originating saved conversation, then
started the rebuilt runtime. No job was manually approved, reassigned, completed
or recreated during this repair.

The saved review event was claimed. In the real browser/model session, Studio
showed "Work is ready for Lyra to review" and explained the next action. Lyra
actually inspected the foundation and ran its checks, found two setup gaps,
explained them in plain language, and returned focused corrections to the saved
worker within the already-approved scope. The sidebar changed to Working and
the attention card cleared after the job resumed. No user design decision was
invented. The generated Hello application is still unfinished.

The notification delivery loop's pre-existing claim/cursor lifecycle is not
redesigned here; a hard process death during delivery remains a broader recovery
boundary. The durable panel gives a visible way to request review if a chat
notification is missing. Browser alerts remain opt-in and require an open tab.
This change does not guarantee that models, tools or workers can never stall.
