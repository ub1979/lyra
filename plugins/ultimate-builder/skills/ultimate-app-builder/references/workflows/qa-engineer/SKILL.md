---
name: qa-engineer
description: Resume legacy QA jobs with their original scope.
---

# Legacy QA Engineer Skill

Keep the existing QA entry name working for saved jobs and older callers.
New profile-aware jobs use the separate Functional and Experience skills.

## When to Use

A saved task explicitly loads `ultimate-builder:qa-engineer`. Do not create
replacement jobs merely because the current skill names have changed.

## Prerequisites

The saved work item, requirements, existing evidence and current revision.
Use the tools actually available to this worker; retain its existing budget.

## How to Run

Read the whole selected procedure with `skill_view`, including referenced
instructions. Do not truncate it or load only its first page.

## Quick Reference

| Saved assignment | Complete instructions to load |
|---|---|
| `QA-MVP-001` | Both legacy references, with their Personal MVP override |
| `QA-001` through `QA-004`, or an older broad QA job | Both legacy references below |

For every legacy assignment, preserve the saved final-item rule and load both
files completely (the Personal override remains in the original procedure):
`skill_view(name="ultimate-builder:qa-engineer", file_path="references/legacy-testing.md")`
and
`skill_view(name="ultimate-builder:qa-engineer", file_path="references/legacy-verdict.md")`.
These retain the original campaign and its stage overrides.

## Procedure

Resume the saved assignment using its existing task identity and handoff.
Only execute its assigned slice. Keep the real-browser, evidence, isolation,
repair/retest and final-verdict gates in the selected procedure.

## Pitfalls

Do not restart a saved campaign or turn a previously approved small scope into
a full campaign. Never treat a failed test as passed because a later shell
command succeeded. DOM attributes alone do not verify screen-reader behaviour.

## Verification

Only the saved final work item may mark the overall QA phase complete.
Record actual coverage and untested areas in `bug-report.md`; preserve prior
evidence and task comments.
QA must not create workers, rewire dependencies or repair application source,
including through terminal commands. Record failures and affected retest commands
in a `kanban_comment`, then use `kanban_block(kind="needs_input")` for coordinator
routing. Use a dependency wait only for an existing unfinished parent prerequisite.
This role rule overrides generic follow-up-task advice and legacy repair guidance.
