# QA dependency routing repairs — 2026-09-19

## Problem and evidence

Tiny Counter QA task `t_01e85095` created repair `t_f73f28e0` with
`parents=[QA]`, so the repair waited for QA. QA itself had no unfinished
prerequisite, but `block_task(kind="dependency")` accepted it and moved it to
`todo`. The dispatcher correctly found no unmet parents and restarted QA.
The second QA attempt then patched application source.

The repair's scratch workspace was intentional Hermes isolation, not a broken
workspace default. Project controls found only exact workspace paths and missed
the related scratch task. Archiving QA satisfied its child's dependency and
allowed that repair to start. The earlier explanation blaming the dispatcher
or calling scratch isolation a missing inheritance bug was too broad.

## Plan and acceptance

1. Validate dependency waits in the shared database boundary (tool and CLI):
   an unfinished prerequisite must exist before releasing the current run.
   Invalid requests must preserve the run and explain the correct link direction
   or `needs_input` fallback. Valid waits resume once after prerequisites finish.
2. Resolve conflicting generic follow-up advice. QA reports defects, preserves
   a failing test and hands off to the coordinator. It must not schedule its own
   replacement/repair workers or patch application source. Use the existing
   plugin tool hook and explicit skill instructions; retain testing/evidence tools.
3. Include exclusively related isolated descendants in project controls while
   preserving other projects and shared dependencies. Stop a related task set
   atomically before reclaiming workers; no child may dispatch between archives.

## Impact and boundaries

Reuse Hermes dependency links, transactions, reclaim/termination and plugin
hooks. No new scheduler, tool schema, migration, model change or mid-session
prompt rewrite. Preserve scratch/worktree isolation and generic Hermes
orchestrators. Application repairs and automatic fresh live journeys are outside
this change. Existing Tiny Counter evidence and dirty application files remain.
New modules/tests stay under 400 lines; existing large integration files receive
only narrow calls or the relevant extracted responsibility.

## Verification

Stage 1: 156 tests pass across `test_kanban_dependency_wait`,
`test_kanban_block_kinds`, `test_kanban_goal_mode` and `test_kanban_tools` via
`scripts/run_tests.sh`. Real SQLite/tool tests cover reversed/no-parent and
finished-parent rejection without mutation, explicit input handoff, valid resume
once and stale-run fencing. Two existing fixtures now create actual prerequisites;
the goal-loop race test finishes its prerequisite before claiming the successor.
One new test initially used the wrong comment-call signature (corrected); local
HTTP fixture tests needed sandbox permission and pass with it.

Pending: plugin delivery, project isolation and stop/claim races. Focused tests
do not establish release stability.

## Deployment and rollback

Local commits per verified stage; no push/version bump. Restart existing gateway
and worker/coordinator processes before live use of changed Python behavior.
Rollback by reverting these focused commits; no stored-data conversion required.
