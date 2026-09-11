# Direct specialist worker bounds / 2026-09-11

User problem and reproduction: A small project's Architecture job stayed active
for more than three hours. The durable Architecture worker interpreted its
playbook's "must run as a spawned agent" wording as an instruction to delegate
its entire already-assigned phase. Two child calls stalled, later fan-out calls
ran for 20 and 87 minutes, and the six-hour/30-turn parent kept retrying while
heartbeats made the process look healthy.

In scope / explicitly deferred: Make Ultimate Builder phase workers execute
their own loaded specialist playbook, remove nested delegation from their tool
surface, and reduce broad-phase attempt/retry bounds. Close the sibling
recovery gaps found while reproducing the incident: orphaned smart approvals,
macOS idle sleep, sleep-charged runtime clocks, judge transport failures, and
rejected terminal calls suppressing the recovery nudge. Preserve partial
project artifacts. Completing the user's generated application is deferred.

Acceptance criteria:

- Every dispatcher-spawned Ultimate Builder specialist has no delegation tool,
  even if the assigned profile normally enables it.
- Ordinary Kanban workers keep their configured delegation tool.
- Specialist prompts and playbooks state that an already-dedicated worker acts
  directly rather than spawning another copy of itself.
- A broad phase attempt is capped at 45 minutes and eight goal turns, with at
  most one retry; a bounded Development work item keeps its two-hour/12-turn
  allowance but uses the same one-retry limit.
- Existing unfinished phase jobs adopt the current execution policy when they
  are reused.
- Headless workers do not inherit interactive/gateway approval markers from
  the parent chat, while hard command guards and explicit deny rules remain.
- A direct project specialist keeps macOS awake while it is running; unavoidable
  host sleep is excluded from task runtime and stale-heartbeat accounting.
- A configured judge whose API request fails cannot permanently reject valid
  completion; repeated judge failures end in a bounded technical block.
- A rejected `kanban_complete` / `kanban_block` call remains recoverable and
  only a committed `{"ok": true}` terminal result suppresses the stop nudge.
- The dedicated Code Reviewer performs independent review lenses directly and
  no longer requires nested agents that are absent from its tool surface.

Affected modules and data: `hermes_cli/kanban_db.py` worker launch and timing
policy, `hermes_cli/goals.py`, both Kanban completion surfaces,
`agent/kanban_stop.py`, `plugins/ultimate-builder/project_runs.py`, specialist
playbooks, and their tests. Existing project files and partial drafts are
retained. The additive migration adds host-local monotonic start/heartbeat
fields to `task_runs`; legacy in-flight rows retain wall-clock fallback.

Tests and observed results: The original focused red tests failed on the old
behavior, then passed after implementation. A later all-agent audit reproduced
the parent-env, host-sleep, judge, terminal-nudge, and reviewer-contract gaps;
its expanded focused scope passes 591 tests with one platform skip. The
Ultimate Builder, version, and standards contract scope passes another 133
tests. After restart, a real direct specialist launched under the macOS idle
sleep assertion, inherited none of the four parent-only interaction flags, ran
the same harmless Python heredoc shape that previously opened an orphan smart
approval, printed `LYRA_WORKER_SMOKE_OK`, and completed the board task in 16
seconds. The repaired Architecture task also completed successfully in run 142
with local project commit `301e6f9` and a verified `plan.md`.

Compatibility / restart: The background service must restart before new worker
processes receive the launch and timing policy. Existing running workers must
be paused or reclaimed first. The sleep assertion is scoped to direct Lyra
specialists on macOS and does not override lid-close sleep.

Rollback / retained recovery data: Revert the release commits. The interrupted
project's `.sdlc/plan-part-1.md`, `.sdlc/security-a.md`, and
`.sdlc/security-b.md` remain untouched for recovery.

Local commit / authorized push: User has repeatedly authorized fixing and
pushing the Lyra reliability release; commit and push after verification.
