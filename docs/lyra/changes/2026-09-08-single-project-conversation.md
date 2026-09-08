# Single project conversation — 2026-09-08

Change / date: Restore one Lyra Studio conversation for project review and input, 2026-09-08.

User problem and reproduction: A blocked project job appeared as a second action card above the composer and as a stopped-job card in Agent Activity while its normal Lyra response also appeared in the transcript. Structured questions, approvals and inferred workflow choices added button groups inside messages, and an optional notification bell added another notification surface. The result looked like two chats and made it unclear where to answer.

In scope / explicitly deferred: Remove Studio's review/attention panel, notification bell and chat choice buttons; keep questions and approval requests as ordinary Lyra messages answered through the one shared composer; restore Agent Activity to running agents only. Preserve durable Kanban subscriptions, request IDs, approval safety, project state, progress/recovery views and Telegram delivery. No task is approved, resumed or changed by this UI change.

Acceptance criteria: Every clarification or approval is readable in the transcript. The user types the answer in the normal message box. Only an explicit valid typed approval is translated to the existing numbered Ink choice; unrelated text cannot approve an action. Agent Activity contains running work, not blocked or waiting notifications. Durable job events still wake Lyra to inspect the saved job and respond in the main conversation.

Affected modules and data: Studio presentation and pure input-formatting helpers under `web/src`, plus the Lyra maintenance map and generated web bundle. No schema, stored conversation, project file, prompt history, toolset or user setting migration.

Tests and observed results: The complete Studio suite passed 389 tests across 47 files. Type checking and the production build passed; lint reported zero errors and 31 pre-existing warnings. Focused real workflow, saved-attention and decomposition tests passed 19 checks. The three relevant real Ink prompt and approval files passed 103 checks. The complete Ink suite reached 1,366 passing tests and one skipped test, with three unrelated heap-dump tests timing out; no changed Ink file was involved.

Compatibility / restart: A rebuilt Studio page is required. Existing backend question and approval protocols remain unchanged, so no saved project data is rewritten.

Rollback / retained recovery data: Revert the focused local commit. Durable jobs and notification subscriptions remain intact throughout.

Local commit / authorized push: Local commit only. No push or release authorized; therefore no Lyra version bump.
