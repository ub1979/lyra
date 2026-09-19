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

Stage 2: the existing plugin hook identifies QA from saved task skills. It
vetoes scheduling/rewiring and application writes through file tools, including
multi-file patches, moves and symlink targets. File paths use the existing
session-cwd resolver. Tests and evidence remain writable and terminal test
commands remain available. This is a workflow guard, not a shell sandbox;
the mandatory skill rule also forbids application repairs through terminal.
Generic follow-up guidance now distinguishes successors from prerequisites
and respects role authority. QA-only findings stay parked pending repair
authorization; full-build coordinators route Development then affected retests.

Stage 2 verification: 221 passed (one skipped) across QA policy, plugin,
focused-skill/workflow and prompt-builder suites. Coverage includes the actual
file-tool cwd resolver and the agent-loop delegation hook as well as ordinary
tool dispatch. The first test run incorrectly sent `delegate_task` through the
ordinary dispatcher; it is agent-loop-intercepted, so that test now exercises
its shared hook entry point.

The broad regression run caught one change-induced failure: the expanded
Kanban guidance exceeded its existing 5,500-character ceiling. Shortened the
new rule to retain authority/dependency semantics without raising the ceiling
(5,483 characters now). No mid-conversation prompt mutation was introduced.

Stage 3: project controls now include isolated descendants only when creation
provenance and all current prerequisites remain within the project; later links
alone do not establish ownership. Explicit other directories/projects and shared
dependencies are excluded. Archived roots remain discoverable anchors. A
relocation preserves scratch/worktree paths instead of merging them into the
shared checkout. Existing failed-job retry still requires the exact project
workspace and cannot bypass input/review waits.

Stop selects and archives the full related active set in one per-board SQLite
write transaction, reusing the same archive implementation as single-card
archive. Workers are terminated only after the set is committed, using Hermes'
existing host-local termination helper. A denied signal or remote PID returns
`ok=false` with `unconfirmed_workers` and an audit event; repeated Stop preserves
that warning rather than blindly signalling a potentially reused PID. Such an
OS/remote termination failure still needs operator inspection. Completed
evidence remains done; normal archive semantics for unselected dependents remain
unchanged. No cross-board transaction or new process supervisor is introduced.

Verification: 1,418 passed, zero failures (two skipped) across 67 files via
`scripts/run_tests.sh plugins/ultimate-builder/tests tests/hermes_cli/test_kanban*.py
tests/tools/test_kanban_tools.py tests/agent/test_prompt_builder.py
tests/skills/test_focused_qa_skill.py`. Tests include real concurrent dispatcher
claims, archive rollback, a real temporary worker process, repeated Stop,
cross-board/project/shared-link isolation, worktrees, relocation and all existing
Kanban archive/dependency/tool contracts. Ruff and Windows-footgun checks pass
for all new modules/tests. No web/Ink source changed; no bundle rebuild required.
New files are below 400 lines; legacy large integration files remain large and
receive only narrow wiring/extraction. No full Studio journey or live QA rerun
was performed for this repair; these checks do not establish release stability.

## Deployment and rollback

Local commits per verified stage; no push/version bump. Restart existing gateway
and worker/coordinator processes before live use of changed Python behavior.
Rollback by reverting these focused commits; no stored-data conversion required.
