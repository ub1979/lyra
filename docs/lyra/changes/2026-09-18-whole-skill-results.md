# Whole skill instructions — 2026-09-18

Problem: Pocket Tasks trial 1 loaded the real requirements skill (21,209
characters), but the coordinator's 8,000-character result budget replaced it
with a preview. Attempts to recover a one-line JSON file through line-limited
reads caused repeated empty results and browser detours before any useful reply.
Evidence and interrupted session ID are in END_TO_END_ACCEPTANCE.md.

Historical comparison: July 29 b196c0397 already had Hermes result persistence
with 100,000-character default results and a 200,000-character aggregate budget
(scaled down for smaller windows). Sep 16 e8542a434 added the coordinator's
8,000/32,000 limits. This skill fits July's default, but not the new result cap.
July was not immune: larger/multiple skills could still cross either budget.

Scope: preserve skill_view instruction results verbatim in per-result, inline
and aggregate admission. Keep existing ordinary-output budgets and compression.
No new model tool, UI, scheduler, skill rewrite, old-message mutation or global
increase of numerical budgets. This instruction-integrity rule applies to
coordinators and workers; ordinary worker result limits remain unchanged.

Trade-off: mandatory instructions can exceed the soft tool-output batch budget.
The model's hard context limit and normal compression remain; this is NOT a
promise that arbitrarily large skills fit any model. Do not silently provide
partial instructions as successful skill loading. Capacity errors remain errors.

Verification: real skill reader and real shipped playbooks, per-result plus
aggregate, multiple skills, low budget, explicit inline cap, ordinary sibling
trimming and unchanged historical prefix. Then scoped storage/budget/agent
tests and a fresh Pocket Tasks trial on a restarted test dashboard only.
Rollback: revert focused code/test change; restart test runtime. No migration.
No release/push sign-off from focused tests. New test file under 400 lines.

Implementation: one shared whole-instruction tool set in budget_config, used by
inline-cap resolution, result persistence and aggregate candidate selection.
Only skill_view is classified; no namespaced skill special cases. Loaded skill
results count toward pressure on ordinary siblings but cannot be previewed.
Only new results are processed; prompt prefix and past messages are untouched.

Regression before fix: 4 failed / 1 passed (ordinary Hermes default admitted
these particular skills; tight coordinator/inline/aggregate cases did not).
After fix: 113 tests passed across six budget/storage/invariant suites; ruff
clean. No numeric budget increase, new configuration switch or schema change.
