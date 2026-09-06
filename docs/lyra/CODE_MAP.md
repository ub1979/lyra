# Lyra maintenance map

Start here, then read the relevant source and tests. This is a navigation map,
not a replacement for repository instructions or proof that a feature works.

## Runtime ownership

```text
Studio panels → dashboard API → project progress / jobs / memory / recovery
Studio question → request-ID answer frame → existing Ink prompt → gateway RPC
Ink chat → Hermes agent → tools / model providers
Durable project jobs → Hermes Kanban dispatcher → isolated worker sessions
```

| Responsibility | Entry points | Verification |
|---|---|---|
| Studio composition | `web/src/pages/ChatPage.tsx` | Web suite and production build |
| Project map / agent artwork | `web/src/components/GuidedProgressMap.tsx`, `web/src/components/GuidedAgentAvatar.tsx` | Rendering tests and production build |
| Durable status polling | `web/src/hooks/useProjectLedger.ts` | Hook tests; project API tests |
| Question lifetime / retry | `web/src/hooks/useGuidedClarification.ts`, `web/src/components/GuidedClarification.tsx` | Inline-message and hook integration tests |
| Live chat feedback / summarizing | `web/src/components/GuidedCoordinatorActivity.tsx` | Timed heartbeat and question-delivery rendering tests |
| Atomic question / approval transport | `apps/shared/src/prompt-answer-frame.ts`, `ui-tui/src/components/prompts.tsx`, `web/src/components/GuidedApprovalActions.tsx` | Real Ink transport and inline-action tests |
| Optional computer alerts | `web/src/components/StudioQuestionAlerts.tsx`, `web/src/lib/question-notifications.ts` | Permission, replay and failure tests |
| Worker presentation | `web/src/lib/project-agent-activity.ts`, `web/src/components/ProjectAgentJobs.tsx` | Pure state and rendering tests |
| Phase reports / evidence | `plugins/ultimate-builder/project_progress.py`, `hermes_cli/project_evidence.py` | Negative status, missing file and path-escape tests |
| Project jobs | `plugins/ultimate-builder/project_runs.py` | Real SQLite lifecycle tests |
| Project-local Git boundary | `plugins/ultimate-builder/project_repository.py`, `scripts/lyra_git_guard.py`, `.githooks/` | Real parent/project repository, commit-hook and push-hook tests |
| Job creation notification policy | `hermes_cli/kanban_notifications.py` | CLI/tool/phase creation, opt-out and idempotent subscription tests |
| Saved review / input handoff | `hermes_cli/project_job_attention.py`, `web/src/lib/project-attention.ts`, `web/src/components/ProjectAttention.tsx` | Latest-event metadata, coordinator envelope and actionable/stale panel tests |
| Approval → worker → chat recovery | `tests/tui_gateway/test_lyra_project_workflow.py`, `tests/fixtures/lyra_workflow_worker.py` | Real prompt/event handlers, subprocess, Git/SQLite, notification retry and final chat event; controlled model/socket boundaries |
| Project worker eligibility | `hermes_cli/project_job_status.py` | Queue rejection, external-worker visibility and assignment-recovery tests |
| Indexed job storage | `hermes_cli/kanban_db.py` | Database, migration and query-plan tests |
| Project Brain | `plugins/ultimate-builder/project_brain.py` | Real Git freshness and citation tests |
| Project move / trash / history | `plugins/ultimate-builder/dashboard/plugin_api.py` | API and relocation tests |
| Recovery snapshots / relocation | `tools/checkpoint_manager.py`, `tools/checkpoint_relocation.py` | Real Git snapshot, move, restore and conflict tests |
| Dashboard / PTY / event replay | `hermes_cli/web_server.py`, `hermes_cli/dashboard_prompt_state.py` | Server, auth and replay tests |
| Chat engine | `tui_gateway/`, `ui-tui/src/app/`, `run_agent.py` | Gateway and Ink suites |
| Model configuration / routing | `hermes_cli/config.py`, `agent/`, `plugins/model-providers/` | Provider/config tests |
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
- Browser alerts require opt-in and a live Studio tab. They are not a background
  push service. Telegram delivery is a separate existing gateway capability.
- Shared-server authentication is not per-user isolation. This release is for
  a trusted operator/profile; separate users need a reviewed isolation design.
- Large route files still exist. Extract one tested responsibility at a time;
  a wholesale rewrite is not a prerequisite for a safe bug fix.

See [change management](CHANGE_MANAGEMENT.md) before implementing or releasing.
