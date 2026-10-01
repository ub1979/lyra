# Plan: Claude Code (Agent SDK) as Lyra's engine

Branch `qadir/claude-engine` (from 0.19.8-a, `93ac367f9`), worktree
`/Users/u/funcoding/lyra-claude-engine`. Experiment, not a replacement: Hermes
stays the default engine; Claude is opt-in per profile via config.

## Goal

Find out whether running Lyra's guided builds on the Claude Agent SDK (Claude
Code as a library) makes builds more reliable and less hands-on than Hermes, at
an acceptable cost — measured on the same project brief, not guessed.

## Facts this plan relies on (Agent SDK docs, fetched 2026-10-01)

- Python package `claude-agent-sdk`; `ClaudeSDKClient` / `query()` with
  `ClaudeAgentOptions`: `cwd`, `model`, `permission_mode`, `allowed_tools`,
  `system_prompt` (preset + `append`), `setting_sources`, `plugins`, `agents`
  (`AgentDefinition`: `description`, `prompt`, `tools`, `model`, `skills`,
  `maxTurns`, `background`, `effort`, `permissionMode`), `hooks`,
  `mcp_servers`, `resume`, `fork_session`, `max_turns`,
  `include_partial_messages`.
- Hooks (Python): `PreToolUse`, `PostToolUse`, `PostToolUseFailure`,
  `UserPromptSubmit`, `Stop`, `SubagentStart`, `SubagentStop`, `PreCompact`,
  `Notification`, `PermissionRequest`.
- Messages: `AssistantMessage`, `StreamEvent` (partial), `ResultMessage`
  (`total_cost_usd`, `usage`, `session_id`, `terminal_reason`), `SystemMessage`,
  `Task{Started,Progress,Notification}Message` for background subagents.
- Auth: **API key required** (or Bedrock/Vertex). Third-party products may not
  use claude.ai subscription login. Cost is pay-per-token.

## Design: swap the agent object, keep everything else

`tui_gateway/server.py` builds one `AIAgent` per chat in `_make_agent()` and
runs turns via `agent.run_conversation(...)` in `_run_prompt_submit()`. The UI
(Ink TUI, Studio web page, project map, worker panel) only sees gateway events.

1. **`agent/claude_engine.py` — `ClaudeEngineAgent`**, duck-typed to the parts
   of `AIAgent` the gateway uses: `run_conversation()` returning
   `{final_response, completed, interrupted, api_calls, messages}`, `interrupt()`,
   `steer()`, usage counters, and the gateway callbacks (text delta, tool
   progress, reasoning). Internally one long-lived `ClaudeSDKClient` per chat,
   resumed by stored Claude `session_id` after restarts.
2. **Event translation:** `StreamEvent` text → `message.delta`; tool use/result
   → `tool.start` / `tool.complete`; `SubagentStart`/`SubagentStop` hooks and
   `Task*Message` → the same `subagent.*` progress events Hermes delegation
   emits (so the worker panel and phase markers work); `ResultMessage` →
   `session.info` usage + cost.
3. **Builder workflow:** add a Claude plugin manifest so
   `plugins/ultimate-builder` loads via `plugins=[{type: local, path}]`;
   specialists (`task-planner`, `sw-developer`, `qa-*`, `security-auditor`, …)
   become `AgentDefinition`s with `background=True` and `maxTurns`; app-it's
   `delegate_task` wording gets an engine-neutral variant. The coordinator gets
   no Bash/Edit tools (port of main's lightweight-coordinator rule).
4. **Safety nets carried over:** `SubagentStop` hook → existing
   `project_checkpoint.checkpoint_project`; `Stop` hook → turn-end checkpoint;
   continuation = resume the subagent / re-dispatch with handoff when a
   subagent ends on `max_turns`.
5. **Approvals:** `PermissionRequest` hook / permission callback → existing
   `approval.request` flow; default `permission_mode="acceptEdits"` inside the
   project folder only.
6. **Config (config.yaml, not env):** `engine: hermes | claude`,
   `claude_engine.model` (default `claude-opus-5-5`),
   `claude_engine.helper_model`, `claude_engine.max_budget_usd` per turn.
   `ANTHROPIC_API_KEY` goes in `~/.hermes/.env` (secret).

## Phases and exit criteria

| Phase | Work | Done when |
|---|---|---|
| 0 Spike | `ClaudeEngineAgent` text + tools in one Studio chat | A guided chat answers, edits a file, streams, shows cost; Hermes path unchanged (tests green) |
| 1 Helpers | specialists as background subagents, worker panel, checkpoints | A 3-task plan runs as parallel helpers, each auto-checkpointed |
| 2 Workflow | plugin manifest, app-it neutral wording, coordinator restrictions, approvals | Requirements → plan → build → QA on a small brief with no manual nudges |
| 3 Fair trial | same brief on both engines (fresh project copies) | Report: wall time, stalls, crashes, human interventions, $ cost, tests, real-integration defects |

## Risks

- **Cost:** API billing replaces the current subscription. Rough scale from
  the 2026-09-30 YouTube window (96M input tokens, 95% cached, 373k output in
  2.5 h): on the order of tens of dollars per such window on Opus 5.5, about
  half on Sonnet 5.5. Phase 0 measures real numbers before any long run.
- **Model lock-in:** Claude models only on this engine.
- **Two session stores:** Claude's session files plus Lyra's `state.db` index;
  the mapping must survive restarts.
- **Not a drop-in for every Hermes feature** (gateway platforms, cron, kanban,
  memory providers stay Hermes-only in this experiment).
