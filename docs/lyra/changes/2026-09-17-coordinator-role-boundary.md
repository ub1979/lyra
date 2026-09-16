# Coordinator role boundary

Problem: explicit/custom tool bundles bypass default Studio trimming. Delegated
subprocesses lose the in-process context marker at the project dispatch gate.
Scope: existing disabled-toolset subtraction at agent construction; shared gate
recognizes the existing subprocess lineage marker. No new tool or sandbox.
Acceptance: explicit bundles cannot restore coordinator shell/code/delegation;
memory, research and requirements editing remain available. Worker tools stay
unchanged. Queue/control refuse delegated subprocesses before any mutation;
status remains readable. No mid-conversation schema mutation.
Tests: 595 tests passed across all gateway suites and project runs/tool suites;
the additional constructor regression passed (17 context-policy tests). Includes
real schema resolution and temporary SQLite handler/API tests. Initial sandbox
run blocked test-child cleanup; permitted rerun passed with safety guard intact.
Compatibility: restart backend/start a new conversation to get the new tool
prefix; existing conversations are not hot-patched. No database migration.
Rollback: revert this release. User authorized separate version/commit/push.
