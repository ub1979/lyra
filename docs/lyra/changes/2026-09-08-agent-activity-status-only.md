# Agent Activity is status-only — 2026-09-08

Change / date: Keep Lyra Studio's Agent Activity panel limited to actual agent status, 2026-09-08.

User problem and reproduction: While Lyra handled a project message, the same state appeared twice: a large "Lyra is handling your message" card with a Stop & retry button in Agent Activity and the normal conversation state in the main chat. Questions and review requests already appeared in the main transcript, so the extra card made the page look like two competing chat surfaces and obscured where the user should answer.

In scope / explicitly deferred: Remove the coordinator message/retry card from desktop and mobile Agent Activity. Keep the Lyra availability and usage summary plus the list of currently working project agents. Keep questions, approvals, typed answers, errors and recovery actions in the main conversation. Do not alter the backend event protocol, watchdog deadlines, worker controls, saved jobs or project data.

Acceptance criteria: Agent Activity identifies Lyra and the agents currently working without showing a duplicate chat/status card or response button. A user question or approval remains a normal main-chat message and the shared composer remains the canonical place to type a reply. Tool and model liveness tracking continue to drive the existing watchdog even though their presentation card is removed.

Affected modules and data: Studio composition in `web/src/pages/ChatPage.tsx`, removal of the obsolete coordinator activity component and its focused rendering test, the Studio production bundle, and Lyra's maintenance inventory. No schema, stored conversation, prompt, toolset, task or generated Hello application data changes.

Tests and observed results: Studio type checking passed. The complete Studio suite passed 388 tests across 48 files, including a direct Agent Activity rendering regression. Lint completed with zero errors and 31 pre-existing warnings. The production Studio build passed. After rebuilding and restarting the dashboard, the live Hello Agent Activity panel showed Lyra availability, usage and four working project agents; it did not show the duplicate "Lyra is handling your message" card or Stop & retry button. A new status request submitted through the main composer received Lyra's complete response in the main transcript without a duplicate sidebar surface.

Compatibility / restart: The Studio production bundle must be rebuilt and the dashboard reloaded or restarted. The dashboard was rebuilt and restarted from the repository virtual environment on port 9119.

Rollback / retained recovery data: Revert the focused local commit. No project or conversation data is migrated or deleted.

Local commit / authorized push: Local commit only. No push or release is authorized, so no Lyra version bump is included.
