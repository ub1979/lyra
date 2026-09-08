# Lyra maintenance map

Start here, then read the relevant source and tests. This is a navigation map,
not a replacement for repository instructions or proof that a feature works.

## Runtime ownership

```text
Studio panels → dashboard API → project progress / jobs / memory / recovery
Studio question → main conversation + shared composer → request-ID answer frame → existing Ink prompt
Ink chat → Hermes agent → tools / model providers
Durable project jobs → Hermes Kanban dispatcher → isolated worker sessions
```

| Responsibility | Entry points | Verification |
|---|---|---|
| Studio composition | `web/src/pages/ChatPage.tsx` | Web suite and production build |
| Project map / agent artwork | `web/src/components/GuidedProgressMap.tsx`, `web/src/components/GuidedAgentAvatar.tsx` | Rendering tests and production build |
| Compact project status / polling | `plugins/ultimate-builder/project_status.py`, `web/src/hooks/useProjectLedger.ts` | Atomic snapshot, malformed/stale fallback, hook and project API tests |
| Question lifetime / typed reply | `web/src/hooks/useGuidedClarification.ts`, `web/src/lib/guided-clarification.ts`, `web/src/pages/ChatPage.tsx` | Message formatting, request fencing and hook integration tests |
| Live chat feedback / summarizing / message time | `web/src/pages/ChatPage.tsx`, `web/src/lib/guided-turn-watchdog.ts`, `web/src/lib/studio-time.ts` | Main-transcript status, timed heartbeat, reconnect, cancellation-control and date/time tests |
| Atomic question / typed approval transport | `apps/shared/src/prompt-answer-frame.ts`, `ui-tui/src/components/prompts.tsx`, `web/src/lib/guided-agent-routing.ts`, `web/src/pages/ChatPage.tsx` | Real Ink transport, explicit typed-choice and request-fencing tests |
| Worker presentation | `web/src/lib/project-agent-activity.ts`, `web/src/components/ProjectAgentJobs.tsx` | Pure state and rendering tests |
| Phase reports / evidence | `plugins/ultimate-builder/project_progress.py`, `hermes_cli/project_evidence.py` | Negative status, missing file and path-escape tests |
| Project jobs / bounded development scheduling / model repair | `plugins/ultimate-builder/project_runs.py`, `plugins/ultimate-builder/project_work_units.py`, `web/src/lib/guided-agent-model-preferences.ts`, `cli.py` goal-loop wiring | Task-graph parsing, real SQLite lifecycle, dependency gates, run fencing and provider/project isolation tests |
| Automatic job decomposition | `hermes_cli/kanban_decompose.py` | Blanket-scope rejection and bounded replacement tests |
| Project-local Git boundary | `plugins/ultimate-builder/project_repository.py`, `scripts/lyra_git_guard.py`, `.githooks/` | Real parent/project repository, commit-hook and push-hook tests |
| Job creation notification policy | `hermes_cli/kanban_notifications.py` | CLI/tool/phase creation, opt-out and idempotent subscription tests |
| Saved review / input handoff | `hermes_cli/project_job_attention.py`, `web/src/lib/project-attention.ts`, `tui_gateway/server.py` | Latest-event metadata, coordinator envelope, notification retry and final chat-event tests |
| Approval → worker → chat recovery | `tests/tui_gateway/test_lyra_project_workflow.py`, `tests/fixtures/lyra_workflow_worker.py` | Real prompt/event handlers, subprocess, Git/SQLite, notification retry and final chat event; controlled model/socket boundaries |
| Project worker eligibility | `hermes_cli/project_job_status.py` | Queue rejection, external-worker visibility and assignment-recovery tests |
| Indexed job storage / worker run exclusion | `hermes_cli/kanban_db.py` | Database, migration, process-lifecycle, respawn-exclusion and query-plan tests |
| Project Brain | `plugins/ultimate-builder/project_brain.py` | Real Git freshness and citation tests |
| Lean coordinator context / cached tool prefix | `tui_gateway/studio_context.py`, `toolsets.py` | Default and explicit configuration, memory/research retention, worker isolation and real schema-size tests |
| Delegated worker liveness | `tools/delegate_tool.py` | Parent heartbeat relay, stale-child interruption, hard-timeout diagnostics and async delegation tests |
| Short live job reports / context accounting | `hermes_cli/project_run_summary.py`, `plugins/ultimate-builder/project_run_cli.py`, `agent/context_breakdown.py` | Real project-local SQLite/CLI, pause freshness, truncation and startup-instruction accounting tests |
| Project move / trash / history | `plugins/ultimate-builder/dashboard/plugin_api.py` | API and relocation tests |
| Recovery snapshots / relocation | `tools/checkpoint_manager.py`, `tools/checkpoint_relocation.py` | Real Git snapshot, move, restore and conflict tests |
| Dashboard / PTY / event replay | `hermes_cli/web_server.py`, `hermes_cli/dashboard_prompt_state.py` | Server, auth and replay tests |
| Chat engine | `tui_gateway/`, `ui-tui/src/app/`, `run_agent.py` | Gateway and Ink suites |
| Studio main AI choice / resumed model | `tui_gateway/studio_model_routing.py`, `tui_gateway/server.py`, `ui-tui/src/app/useSessionLifecycle.ts` | Saved GLM → selected Claude subprocess test, resume RPC and failure-retention tests |
| Model configuration / routing | `hermes_cli/config.py`, `hermes_cli/external_cli.py`, `agent/`, `plugins/model-providers/` | Provider/config, trusted CLI discovery and routing tests |
| Remote control | `gateway/`, Telegram routes in `hermes_cli/web_server.py` | Gateway/platform and onboarding tests |
| Release gates | `.github/workflows/ci.yml`, `scripts/run_tests_parallel.py` | CI classification/discovery tests |

## Complete file inventory

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
