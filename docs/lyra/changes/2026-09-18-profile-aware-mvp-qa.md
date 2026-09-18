Change / date: Profile-aware MVP QA, 2026-09-18
User problem and reproduction: The launcher chooses a build profile, but Studio rebuilds setup with “no build scale selected”; QA always queues four stages and only QA-004 may finish.
In scope / explicitly deferred: Carry the launcher choice through Studio and into the existing project_run queue call. Give personal projects one real smoke QA work item and final rule. Keep four legacy stages when no profile is supplied. No new settings database or QA split.
Acceptance criteria: A personal run queues one QA item that tests the core app and can finish; no-profile legacy runs keep four stages and recovery. The chosen profile persists across browser reload and new conversation in the same workspace.
Affected modules and data: Launcher seed, Studio setup, project_run tool, queue work plan, QA skill and tests. New QA task identities are additive; old jobs retain their IDs.
Tests and observed results: 140 plugin tests and 472 web tests passed; web typecheck and Ruff passed. The browser-to-model-to-queue choice has not been verified in a live project. The profile is carried in the setup seed and restored from workspace browser storage; no cross-browser settings authority was added.
Compatibility / restart: New frontend and plugin code required. Existing active jobs keep their current task graph.
Rollback / retained recovery data: Revert code and keep existing Kanban tasks; do not downgrade during an active new MVP QA job.
Local commit / authorized push: `fa04e4709`; not pushed.
