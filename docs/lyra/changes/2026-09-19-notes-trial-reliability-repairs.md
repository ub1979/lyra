# Tiny Notes follow-up repairs — 2026-09-19

## Authority and scope

The user approved the reviewed focused plan and reserved the live application
journey for their own testing. Implement and verify locally, one commit per
stage. Do not restart the user's processes, change their provider/configuration,
repair generated projects, push, or claim a new live acceptance pass.

Evidence: [frozen Tiny Notes trial](../2026-09-19-focused-qa-notes-e2e.md).
Starting candidate: `a1b7a2581`, version 0.19.64 beta (unpublished).

## Stages and invariants

1. Browser dialogs: reproduce the local backend's native confirm path, reuse
   existing agent-browser dialog operations and preserve pending-dialog output.
   Existing CDP routing, explicit accept/dismiss, task isolation, redaction and
   unsupported-backend errors must remain intact. No automatic destructive
   acceptance, global browser restart or extra browser implementation.
2. Coordinator usage: reconcile saved lifetime usage with runtime reporting;
   do not change billing writes, prompt context or worker accounting. Cover cold
   restart, next turn, reconnect, unknown values and session isolation.
3. QA acceptance: distinguish finished work from verified project acceptance.
   Use the builder's existing reporting/task mechanisms, not another LLM judge
   or scheduler. Missing required coverage means needs review with an actionable
   recovery path. Functional completion must not deadlock Experience; existing
   campaigns and reports remain usable. Evidence presence is not truth proof.
4. Preview copy: name the validated registered preview(s), not a hard-coded
   index.html. Leave trusted approval and digest checks unchanged.
5. Diagnostic delays: investigate repeated fresh-diagnostic waits. Change only
   a reproduced cause; retain stale-diagnostic protections and healthy-server
   behaviour. Record any remaining uncertainty explicitly.

## Change safety and tests

Each stage records its exact implementation, impact, regression results and
rollback below before a local commit. New helpers/tests stay under 400 lines;
large existing files receive thin integrations only. Run behavioural unit and
real temporary-filesystem/SQLite/browser checks as appropriate through the
canonical runner. No paid model calls or end-to-end generated project journey.
Preserve unrelated untracked user files. Rebuild generated assets if affected;
regenerate the tracked-file inventory. No schema/data migration is planned.
Rollback uses focused revert commits; saved chats, usage, jobs and projects are
retained. Running processes need an intentional later restart to load changes.

## Results

### Stage 1 — local browser dialog recovery

The actual installed agent-browser 0.26.0 CLI provides dialog operations, but
a click waiting on confirm occupies its command queue: subsequent snapshot and
dialog commands also wait. A real disposable-page probe reproduced this before
the fix. The existing CDP supervisor offers the required independent connection.

Local navigation now discovers the same task-owned browser's loopback endpoint
and attaches the existing supervisor to the exact navigated page. This matters:
Chrome also has a spare new-tab page; the old first-page selection observed the
wrong target. Local supervision uses native dialogs without the cloud-only XHR
bridge; existing remote defaults are unchanged. Task --session routing stays
unchanged. A pending dialog releases only the waiting CLI client, not the browser
or worker, and is preserved in tool responses. Subsequent page operations return
the dialog instead of entering the blocked queue; accept/dismiss uses the same
task/sidecar supervisor. No automatic acceptance or raw-CDP schema expansion.

Verification: 198 tests passed across ten browser suites, including eight new
tests and three real local-browser cases (accept, cancel, prompt, subsequent
navigation, wrong-task/stale-dialog rejection). Real clicks return the pending
dialog within the test's 10-second bound; the whole local suite took 8.5s.
Existing CDP, hybrid routing, private-page guards, console, Lightpanda and
deadline tests passed. Ruff and diff checks passed. Initial integration tests
failed on wrong-page attachment; that failure was fixed, not relabelled. Test
cleanup uses exact UUID-owned daemon identity, with pytest's explicit daemon
cleanup allowance. No application journey or user's running process was used.

Compatibility: older CLIs without endpoint discovery remain navigable but cannot
gain local dialog recovery; the dialog tool reports an unavailable supervisor.
The new capability is picked up on a fresh agent process; no live toolset or
historical prompt is rewritten. Revert this stage to restore old browser paths;
there is no persisted data migration.

Other stages remain in progress; no overall completion claim yet.
