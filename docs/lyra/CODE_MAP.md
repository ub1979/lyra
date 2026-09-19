# Lyra maintenance map

Start here, then read the relevant source and tests. This is a navigation map,
not a replacement for repository instructions or proof that a feature works.

## Runtime ownership

Current product acceptance plan and resume checkpoint:
[`END_TO_END_ACCEPTANCE.md`](END_TO_END_ACCEPTANCE.md). Read before resuming the
small-project reliability trial; generated application repairs belong to Lyra.
Use [`Studio test preflight`](STUDIO_TEST_GUIDE.md) to establish runner readiness,
single-submit testing and evidence attribution before a live project journey.

Latest independent verification: [frozen calculator trial](2026-09-19-calculator-live-trial.md)
completed functionally but failed clean acceptance. Current follow-up:
[contract repair analysis](2026-09-19-reliability-synthesis-and-action-plan.md) and
[implementation/testing record](changes/2026-09-19-workflow-contract-repairs.md).
The user reserved the next live journeys for their own testing. Earlier
[revision 6 verification](changes/2026-09-18-revision6-verification-followup.md)
remains evidence, including the unresolved Trial 4 storage incident.

Previous implementation plan: [bounded project execution plan, revision 6](2026-09-18-bounded-project-execution-plan-v6.md),
with [reviewed comparison evidence](2026-09-18-end-to-end-comparison-report.md).
Revision 6 corrects revision 5's budget, runner-health, test and approval
details. Both supersede the prior proposed task-map approach: they are based on the
Trial 3 worker trace and keep a Personal project as one lean, bounded worker
until measured acceptance proves a split is necessary. Product implementation,
live journey, and release guarantees remain unverified.

```text
Studio panels → dashboard API → project progress / jobs / memory / recovery
Studio question → main conversation + shared composer → request-ID answer frame → existing Ink prompt
Ink chat → Hermes agent → tools / model providers
Durable project jobs → Hermes Kanban dispatcher → isolated worker sessions
```

| Responsibility | Entry points | Verification |
|---|---|---|
| Studio composition | `web/src/pages/ChatPage.tsx` | Web suite, production build and real Chrome agent-picker repaint path |
| User-initiated Studio startup | `web/src/lib/guided-project-setup.ts` | First-request recovery and browser smoke: no inference on empty open |
| Targeted failed-job recovery | `plugins/ultimate-builder/project_task_recovery.py` | Real SQLite/tool/CLI isolation, dependency, stale-event and rollback tests |
| Project map / agent artwork | `web/src/components/GuidedProgressMap.tsx`, `web/src/components/GuidedAgentAvatar.tsx` | Rendering tests and production build |
| Compact project status / polling | `plugins/ultimate-builder/project_status.py`, `web/src/hooks/useProjectLedger.ts` | Atomic snapshot, malformed/stale fallback, hook and project API tests |
| Question lifetime / typed reply | `web/src/hooks/useGuidedClarification.ts`, `web/src/lib/guided-clarification.ts`, `web/src/pages/ChatPage.tsx` | Message formatting, request fencing and hook integration tests |
| Live chat feedback / summarizing / message time | `web/src/pages/ChatPage.tsx`, `web/src/lib/guided-turn-watchdog.ts`, `web/src/lib/guided-connection-recovery.ts`, `web/src/lib/studio-time.ts` | Main-transcript status, timed heartbeat, transient setup retry, recovered-error cleanup, reconnect, cancellation-control and date/time tests |
| Atomic question / typed approval transport | `apps/shared/src/prompt-answer-frame.ts`, `ui-tui/src/components/prompts.tsx`, `web/src/lib/guided-agent-routing.ts`, `web/src/pages/ChatPage.tsx` | Real Ink transport, explicit typed-choice and request-fencing tests |
| Worker presentation | `web/src/lib/project-agent-activity.ts`, `web/src/components/ProjectAgentJobs.tsx` | Pure state and rendering tests |
| Durable worker usage accounting | `hermes_cli/kanban_usage.py`, `plugins/ultimate-builder/project_runs.py`, `web/src/lib/project-agent-usage.ts`, `cli.py` worker hook | Real SQLite record/latest/prompt-isolation tests, run-state field test, null-preserving totals and rendering tests |
| Notification delivery busy state | `tui_gateway/notification_turn.py`, `tui_gateway/server.py` | Helper outcome tests and real SQLite rejected/accepted claim poller tests |
| Coordinator dispatch tool | `plugins/ultimate-builder/project_run_tool.py`, `plugins/ultimate-builder/__init__.py`, `toolsets.py` (`project-guide`) | Real SQLite queue/status/control, worker gate, registry-merge and no-shell toolset tests |
| Coordinator context budget | `tui_gateway/studio_budget.py`, `tools/budget_config.py` (`inline_caps`), `agent/tool_executor.py` | Budget composition, marked-agent routing, pinned inline truncation, cache preservation, memory-aware compression cap and model-switch tests |
| Provider-facing preflight sizing | `agent/request_token_projection.py`, `agent/turn_context.py` | Custom-provider reasoning exclusion, echo-provider preservation, API sidecar/image/tool estimates and cache-safe history tests |
| Whole skill instruction delivery | `tools/budget_config.py`, `tools/tool_result_storage.py` | Real shipped skill-reader results through inline, per-result and aggregate stages; ordinary sibling bounds and historical-prefix preservation in `tests/tools/test_skill_result_integrity.py` |
| Whole-document batch admission | `tools/inline_result_admission.py`, `tools/tool_result_storage.py` | Many-read budget, intact Brain, explicit omission, source retention, tool-call structure and worker isolation tests |
| Turn-free job updates | `tui_gateway/notification_policy.py`, `web/src/lib/guided-job-notice.ts`, `tui_gateway/server.py` | Turn-policy table, poller notice-vs-turn tests, workflow integration and notice rendering tests |
| Studio event fold | `web/src/lib/guided-event-state.ts`, `web/src/lib/guided-event-reducer.ts`, `web/src/lib/guided-tool-events.ts` | Pure state tests, real-frame replay from `tests/fixtures/studio_frames/` (captured by `tests/tui_gateway/frame_fixtures.py`), journey tests |
| Studio coordinator usage cache | `web/src/lib/guided-usage-cache.ts`, `web/src/pages/ChatPage.tsx` | Same-session reconnect, new-session isolation, unknown versus zero tests |
| Coordinator invariants | `tests/tui_gateway/test_coordinator_invariants.py` | Each guarantee checked across every stage it crosses: schema → gate → handler → queue; result cap → aggregate cap; rejected claim → next turn; attempts → run-state total |
| Studio browser smoke | `apps/desktop/e2e-studio/` (`studio-smoke.spec.ts`, `studio-dashboard.ts`, `echo-model.ts`), `apps/desktop/playwright.studio.config.ts` | Real dashboard + node terminal child + gateway + echo model in headless Chromium: two user turns keep both replies, Tokens panel reports (`npm run test:e2e:studio`) |
| Turn history persistence | `tui_gateway/server.py` (`_run_prompt_submit` baseline re-read after `_sync_agent_model_with_config`), `web/src/lib/guided-reply-warning.ts` | Journey `tests/tui_gateway/test_studio_turn_history_persists.py` (model adoption mid-turn keeps the reply; external edit is reported), frame fixture `reply-not-saved.jsonl` replayed in the reducer, warning-line unit tests |
| Backend readiness contract | `hermes_cli/web_server.py` (ready token), `apps/desktop/electron/backend-ready.ts`, `remote-lifecycle.ts`, `windows-remote-lifecycle.ts`, `scripts/iso-certify.py` | `tests/hermes_cli/test_ready_sentinel.py` matches every listener's pattern against the printed line; desktop readiness unit tests |
| Startup provider identity | `tui_gateway/provider_identity.py`, `tui_gateway/server.py` | Alias/class/endpoint comparison tests; turn-history journey verifies no redundant switch and genuine endpoint/model adoption |
| Provider address guidance | `web/src/components/ProviderAddressNotice.tsx`, `web/src/pages/ModelsPage.tsx` | Rendering test distinguishes saved-address edits from ordinary model selection |
| Reproducible file index | `scripts/lyra_code_map.py` | Tracked-files-only inventory test on a temporary repository; `--check` as its own CI job (`tests.yml` `file-index`) |
| Packaged app name | `apps/desktop/package.json` (`build.executableName`), `hermes_cli/main.py` (`_desktop_executable_names`), `hermes_cli/gui_uninstall.py`, `apps/desktop/scripts/test-desktop.mjs`, `apps/desktop/e2e/fixtures.ts` | Launcher lookup tests per platform incl. pre-rebrand fallback; uninstall candidate-name test; packaged CI job |
| Packaged first-run connection | `apps/desktop/e2e/launch-packaged-connection.spec.ts` | Actual package, isolated real backend and mock model: wrong-token rejection, authenticated chat and reload; packaged CI job |
| Phase reports / evidence | `plugins/ultimate-builder/project_progress.py`, `hermes_cli/project_evidence.py` | Negative status, missing file and path-escape tests |
| Project jobs / bounded development scheduling / model repair | `plugins/ultimate-builder/project_runs.py`, `plugins/ultimate-builder/project_work_units.py`, `web/src/lib/guided-agent-model-preferences.ts`, `cli.py` goal-loop wiring | Task-graph parsing, real SQLite lifecycle, dependency gates, run fencing and provider/project isolation tests |
| Automatic job decomposition | `hermes_cli/kanban_decompose.py` | Blanket-scope rejection and bounded replacement tests |
| Bounded QA / budget handoff | `plugins/ultimate-builder/project_work_units.py`, `agent/worker_handoff.py`, `agent/turn_finalizer.py` | Real dependency/retry/legacy-job tests; real agent tool-loop cache-prefix and delegated-child isolation tests; SQLite summary persistence and stale-run fencing |
| Functional / Experience QA selection | `plugins/ultimate-builder/project_qa_workflow.py`, `qa-functional`, `qa-experience`, `qa-evidence` plugin skills | Real SQLite profile/opt-in/dependency/final-item/reopen/legacy/control tests; registered skill delivery and budget integrity in `tests/skills/test_focused_qa_skill.py` |
| Project-local Git boundary | `plugins/ultimate-builder/project_repository.py`, `scripts/lyra_git_guard.py`, `.githooks/` | Real parent/project repository, commit-hook and push-hook tests |
| Worker Git ancestry | `hermes_cli/worker_git_guard.py`, `hermes_cli/kanban_db.py`, `tools/code_execution_tool.py` | Real Git ref transactions, Python execution, existing hooks, credential scrub and spawn tests |
| Job creation notification policy | `hermes_cli/kanban_notifications.py` | CLI/tool/phase creation, opt-out and idempotent subscription tests |
| Saved review / input handoff | `hermes_cli/project_job_attention.py`, `web/src/lib/project-attention.ts`, `tui_gateway/server.py` | Latest-event metadata, coordinator envelope, notification retry and final chat-event tests |
| Approval → worker → chat recovery | `tests/tui_gateway/test_lyra_project_workflow.py`, `tests/fixtures/lyra_workflow_worker.py` | Real prompt/event handlers, subprocess, Git/SQLite, notification retry and final chat event; controlled model/socket boundaries |
| Project worker eligibility | `hermes_cli/project_job_status.py` | Queue rejection, external-worker visibility and assignment-recovery tests |
| Indexed job storage / worker run exclusion | `hermes_cli/kanban_db.py` | Database, migration, process-lifecycle, respawn-exclusion and query-plan tests |
| Dispatcher wake-up | `hermes_cli/kanban_dispatch_wakeup.py`, `gateway/kanban_watchers.py`, `plugins/ultimate-builder/project_runs.py` | Cross-process signal, post-commit visibility, real daemon, periodic fallback and shutdown tests |
| Project Brain | `plugins/ultimate-builder/project_brain.py` | Real Git freshness and citation tests |
| Workflow contract / learning reconciliation / trivial-change boundary | `plugins/ultimate-builder/workflow_contract.json`, `plugins/ultimate-builder/workflow_contract.py`, `plugins/ultimate-builder/project_learnings.py`, `plugins/ultimate-builder/trivial_change.py`, `plugins/ultimate-builder/project_run_cli.py` | Contract evidence and alias validation, concurrent legacy import, real Git diff classification and queue preflight tests |
| Lean coordinator context / cached tool prefix | `tui_gateway/studio_context.py`, `toolsets.py` | Default and explicit configuration, memory/research retention, worker isolation and real schema-size tests |
| Delegated worker liveness | `tools/delegate_tool.py` | Parent heartbeat relay, stale-child interruption, hard-timeout diagnostics and async delegation tests |
| Short live job reports / context accounting | `hermes_cli/project_run_summary.py`, `plugins/ultimate-builder/project_run_cli.py`, `agent/context_breakdown.py` | Real project-local SQLite/CLI, pause freshness, truncation and startup-instruction accounting tests |
| Project move / trash / history | `plugins/ultimate-builder/dashboard/plugin_api.py` | API and relocation tests |
| Recovery snapshots / relocation | `tools/checkpoint_manager.py`, `tools/checkpoint_relocation.py` | Real Git snapshot, move, restore and conflict tests |
| Dashboard / PTY / event replay | `hermes_cli/web_server.py`, `hermes_cli/dashboard_prompt_state.py` | Server, auth and replay tests |
| Chat engine / auxiliary compression / Kanban terminal stop | `tui_gateway/`, `ui-tui/src/app/`, `run_agent.py`, `agent/auxiliary_client.py`, `agent/kanban_stop.py`, `agent/tool_executor.py` | Gateway, Ink, auxiliary timeout, compression and Kanban stop suites |
| Studio main AI choice / resumed model | `tui_gateway/studio_model_routing.py`, `tui_gateway/server.py`, `ui-tui/src/app/useSessionLifecycle.ts` | Saved GLM → selected Claude subprocess test, resume RPC and failure-retention tests |
| Model configuration / routing | `hermes_cli/config.py`, `hermes_cli/external_cli.py`, `agent/`, `plugins/model-providers/` | Provider/config, trusted CLI discovery and routing tests |
| Remote control | `gateway/`, Telegram routes in `hermes_cli/web_server.py` | Gateway/platform and onboarding tests |
| Release gates | `.github/workflows/ci.yml`, `scripts/run_tests_parallel.py` | CI classification/discovery tests |

## Complete file inventory

Calculator follow-up boundaries:

- Capability-aware finish verification: `agent/verification_stop.py`; real agent
  regression in `tests/run_agent/test_verification_continuation_budget.py`.
- Trusted selected-preview handoff: `plugins/ultimate-builder/preview_selection.py`,
  `preview_authorization.py`; actual clarify/queue tests in the plugin suite.
- Personal Documentation: `worker_guidance.py` and the Technical Writer skill;
  real per-profile queued-body regressions in `test_worker_guidance.py`.
- Personal QA execution: `worker_guidance.py` directs repeatable real-browser
  journeys instead of per-keystroke model round trips; the same queue tests
  preserve other profiles, coverage gates and existing-job bodies. See
  [`QA execution change`](changes/2026-09-19-personal-qa-execution.md).
- New profile-aware QA: `project_qa_workflow.py` selects complete Functional
  and Experience skills with a shared evidence contract. Personal defaults to
  Functional; Reusable/Production use both. Existing jobs keep their saved shape;
  new jobs avoid the old whole-campaign guidance. See
  [`focused QA split`](changes/2026-09-19-focused-qa-skills.md). The
  [`Tiny Notes live trial`](2026-09-19-focused-qa-notes-e2e.md) completed after
  assisted recovery, not a clean autonomous pass; it records browser-dialog,
  restart-usage and approved-QA-criteria follow-ups.
- Manifest-free Node evidence: `agent/node_test_command.py` and
  `tests/agent/test_node_test_evidence.py`.
- One-shot outcomes: existing `cron/executions.py` ledger, `tools/cronjob_tools.py`,
  `tests/tools/test_cronjob_run_outcome.py`.
- Installed design-resource ownership: shared `skills/ui-ux/design-quality/`
  resource packages and `tests/skills/test_design_resource_install.py`.
- Coordinator status: `web/src/lib/coordinator-status.ts`; Studio reuses existing
  turn and connection signals, not an additional event system.

Paste ownership: `ui-tui/src/app/useComposerState.ts`, `useSubmission.ts` and
`ui-tui/src/domain/queuedPrompt.ts`; real mounted-hook regressions in
`ui-tui/src/__tests__/composerPasteSubmission.test.ts` cover stale renders,
literal queue drains and shell-command boundaries. Studio browser smoke covers
the actual PTY-to-model path.

New-project submission lifetime: `web/src/lib/guided-composer-paste.ts` owns
connection identity checks; `ChatPage.tsx` keeps lookup readiness stable while
consuming the builder seed. The Studio smoke now creates a project through the
actual form, checks one submission, reload and a follow-up turn. See
[`startup lifecycle repair`](changes/2026-09-19-startup-submit-lifecycle.md) and
[`calculator follow-up evidence`](2026-09-19-calculator-e2e-followup.md).

[`file-index.tsv`](file-index.tsv) lists maintained repository files with an
area and short mechanical summary. Search it; do not load thousands of entries
into every AI context. Generated assets are labelled, not interpreted.
Private generated projects, output folders, dependencies and environment files
are deliberately excluded. The inventory is not an API or a coverage report.

Regenerate with `python scripts/lyra_code_map.py`; verify with `--check`.
Short descriptions are navigation hints. Confirm a file's actual responsibility
before making a change, especially when a filename-based summary is used.

## Boundaries to preserve

- Studio complements the existing Ink chat; do not create another agent loop.
- An agent saying “done” is a report. Local evidence availability is not proof
  of test success, correctness or user approval.
- Project Brain freshness is separate from factual accuracy. No secrets or raw
  chats belong in memory or this map.
- Never update historical prompts or toolsets mid-conversation.
- Telegram delivery remains a separate existing gateway capability; Studio
  questions and approvals stay in the project conversation.
- Shared-server authentication is not per-user isolation. This release is for
  a trusted operator/profile; separate users need a reviewed isolation design.
- Large route files still exist. Extract one tested responsibility at a time;
  a wholesale rewrite is not a prerequisite for a safe bug fix.

See [change management](CHANGE_MANAGEMENT.md) before implementing or releasing.
