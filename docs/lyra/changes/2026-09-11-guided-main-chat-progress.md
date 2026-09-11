# Guided main-chat progress — 2026-09-11

Change / date: Restore visible coordinator progress in Lyra Studio's canonical conversation, 2026-09-11.

User problem and reproduction: After the user typed `i approve`, Lyra processed the approval successfully for 2 minutes 56 seconds, but the main conversation displayed no working state until the final answer arrived. The Agent Activity panel correctly stopped presenting a duplicate coordinator card in the earlier status-only change, but no equivalent progress remained in the canonical chat surface.

In scope / explicitly deferred: Show one compact, non-interactive working bubble after the latest main-chat message while the coordinator turn is active. Keep Agent Activity status-only and keep all questions and approvals as normal transcript messages answered through the shared composer. Do not add choice or retry buttons, change watchdog timing, alter event transport, optimize approval processing, or modify project data.

Acceptance criteria: A submitted message immediately leaves visible progress in the main conversation; structured model and tool events can update its plain-language detail; it disappears when the turn settles; questions and approvals do not gain a competing status card; the sidebar does not regain the removed coordinator notification.

Affected modules and data: Studio composition in `web/src/pages/ChatPage.tsx`, a focused server-rendering regression test, the Studio production bundle, and Lyra's maintenance inventory. No schema, stored conversation, prompt, toolset, worker, or generated application data changes.

Tests and observed results: The complete Studio suite passed 404 tests across 51 files. Studio type checking passed, lint completed with zero errors and 31 pre-existing warnings, and the production bundle built successfully. Focused server rendering verifies that working progress is present in the main conversation, carries an accessible live status, contains no action buttons, and disappears when idle; the existing Agent Activity regression still verifies that the sidebar does not regain a coordinator card.

Compatibility / restart: The Studio production bundle must be rebuilt. A browser reload is sufficient after the dashboard serves the rebuilt bundle; a backend restart is not required for this presentation-only change.

Rollback / retained recovery data: Revert the focused local commit. No project or conversation data is migrated or deleted.

Local commit / authorized push: Implemented and verified in this local change set. No push has been requested for this follow-up yet.
