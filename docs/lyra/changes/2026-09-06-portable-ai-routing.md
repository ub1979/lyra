# Portable AI routing — 2026-09-06

## Problem and reproduction

On a second computer, Claude Code can work in an interactive terminal while
Lyra reports it missing because the already-running dashboard inherited a PATH
without the user's local binary directory. After the user changes the project
model from Ollama to Claude CLI, an existing project job can still invoke
Claude with an old `glm-5-2:cloud` model override. Claude then rejects that
foreign model on every retry.

## Acceptance criteria

- Claude CLI discovery uses an explicit configured command first, then PATH,
  then a narrow list of trusted per-user installation locations.
- Discovery verifies the exact resolved executable with Claude's read-only auth
  status command; it never scans arbitrary directories or imports credentials.
- Agent model assignments are scoped to the selected project and provider.
- A selected specialist model carries its provider together with the model.
- Reusing a queued or blocked project phase synchronizes its model and provider
  override, including clearing an old override when the user chooses Follow
  project model.
- A provider change never sends a model from the previous provider to the new
  provider and never guesses a replacement.
- Legacy unscoped browser assignments are ignored safely rather than silently
  attributed to whichever provider happens to be active.

## Scope, compatibility and recovery

No credentials, project source files, or conversation history are migrated.
The old unscoped browser preference remains unread and can be removed after the
new scoped preference is saved. Existing jobs retain their history and task
identity; only their explicit routing override is synchronized when the phase
is queued again. Rollback is the focused Lyra release commit.

## Verification

- 101 Python checks passed across the full Ultimate Builder plugin, trusted CLI
  discovery/authentication, project Git isolation, project RPC, and the real
  approval-to-worker recovery workflow.
- 559 additional release, independence, dashboard-server, and version-label
  checks passed.
- All 385 Studio web tests passed; lint, TypeScript checking, and the production
  web build passed.
- The generated dashboard bundle was rebuilt and the maintained-file map was
  regenerated and checked.

Lyra must be restarted to load the new Python resolver and API route. Existing
project history is retained. The next Studio connection synchronizes active
saved jobs to the selected project/provider routing.
