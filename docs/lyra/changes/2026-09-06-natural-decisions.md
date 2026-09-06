# Natural project decisions — 2026-09-06

## Problem and reproduction

Studio renders every durable project job as a card in Agent Activity and merges
ad-hoc `job:*` tasks into the Project Map. A build with several saved tasks
therefore shows the same labels on both sides. Structured clarification events
are also copied into the conversation as a Lyra message while a second question
panel repeats the question above the transcript.

## Acceptance criteria

- Agent Activity shows only agents that are working now; completed, queued and
  waiting jobs remain available through project progress and recovery state.
- Project Map shows named delivery phases, not ad-hoc saved task titles.
- A structured question appears once as a Lyra conversation message, with its
  choices and custom-answer field attached directly to that message.
- A command approval appears once as a Lyra conversation message, with approval
  choices attached and technical command text collapsed by default.
- Answers continue to use the existing request-fenced TUI transport. Approval
  choices continue to use the existing Ink transport; no second chat loop or
  inferred approval is introduced.
- Reloads, duplicate events, stale status and escaped untrusted text remain safe.

## Scope, compatibility and recovery

This is a presentation/projection change. Durable jobs, progress ledgers,
question IDs, approval transport, project files and conversation history are
not migrated or deleted. Existing generic jobs remain recoverable even though
their individual titles no longer occupy the phase map. A browser reload is
enough after the updated web assets are running. Rollback is the focused Lyra
release commit.

## Verification

- The focused project-progress suite passed: 12 tests.
- The complete Studio web suite passed: 50 files and 379 tests.
- The Lyra builder, project workflow, project isolation, attention and code-map
  regression set passed: 13 files and 105 tests.
- Web lint completed with no errors, TypeScript type checking passed, and the
  production Studio bundle rebuilt successfully.
- The final release guard and clean-checkout smoke checks are recorded by the
  release commit.
