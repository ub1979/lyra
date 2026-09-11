# Workflow contract and state consolidation — 2026-09-11

Change / date: Make Lyra's software-delivery rules smaller, explicit, and
mechanically checkable without weakening quality, 2026-09-11.

User problem and reproduction: The current Ultimate Builder workflow mixes
runtime-enforced invariants with prose-only guidance, loads overlapping rule
sets into workers, retains foreign-runtime aliases in imported playbooks,
writes debugging lessons to a second unreconciled log, and requires a full
change record even for changes that cannot affect executable behavior. Static
inspection on Lyra 0.19.30 confirmed all five conditions.

In scope / explicitly deferred: Add one versioned workflow contract and its
validator; make the canonical learning store reconcile legacy debugging
lessons without deleting history; remove stale foreign-runtime instructions;
add a deliberately narrow, mechanical trivial-change classifier; and replace
duplicated worker rules with references to the contract where doing so reduces
context without removing requirements. Do not weaken workspace, permission,
testing, evidence, review, release, or Git boundaries. Do not automatically
rewrite user projects or delete legacy learning files.

Acceptance criteria: The contract identifies enforced versus model-guided
rules and reports their ratio; every declared enforcement target exists; stale
tool aliases are rejected in active specialist playbooks; legacy debugging
lessons are read through the canonical learning view with deterministic
deduplication; only tiny corrections to non-executable, non-control prose or
comments can be classified trivial; and focused plus existing Lyra suites pass
from a clean candidate.

Affected modules and data: Ultimate Builder workflow metadata, project-run
startup, specialist playbooks, focused contract, learning and diff-classifier
modules and tests, changelog, maintenance map, and file inventory. Existing
`.sdlc/learnings.jsonl` and `.sdlc/debug-learnings.jsonl` remain readable. No
database migration.

Tests and observed results: 134 focused and compatibility tests passed across
all Ultimate Builder tests, plugin CLI registration, project-run summaries,
Lyra independence/privacy/Git-guard/code-map discovery, and the real
TUI-gateway project workflow. Ruff checks passed for every affected Python
module and test. The live contract report returned version 1.0.0, 23 declared
critical rules, 11 enforced, 12 model-guided, and no validation errors. The
maintained file inventory was regenerated and its isolated check passed.

Compatibility / restart: Existing projects and saved jobs remain compatible.
Legacy debugging logs are imported non-destructively when a project run is
queued; the old file is retained for rollback.

Rollback / retained recovery data: Revert the focused local commit. The legacy
learning file is never deleted, and imported entries retain their source so a
rollback loses no original data.

Local commit / authorized push: The implementation is committed as
`165c605d5`. The user authorized a Git push on 2026-09-11; release metadata is
synchronized as Lyra 0.19.31 in the following release commit.
