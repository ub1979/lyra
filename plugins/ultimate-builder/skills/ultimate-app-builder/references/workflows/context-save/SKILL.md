---
name: context-save
description: Repairs, condenses, or audits Lyra's verified Project Brain at .sdlc/project-brain.md. Use for memory repair, handoff audits, context recovery, saving progress, wrapping up, or when project memory is stale or oversized.
---

# Project Brain

Maintain a compact, verified retrieval map so a fresh Lyra agent can resume a
large project without loading the full conversation or trusting stale notes.
All project agents update this file automatically; this specialist is for a
manual audit, repair, migration, or handoff.

## Non-negotiable rules

- Target: `.sdlc/project-brain.md`.
- Maximum size: 16 KB. Condense before finishing if it exceeds the limit.
- Verify every material claim against current files, tests, or Git history.
- Preserve durable decisions and their rationale. Replace stale current-state
  and next-action text; do not append a session diary.
- Store evidence as compact relative paths and, when useful, Git commit ids.
- Never store secrets, credentials, personal data, full source files, raw chat
  transcripts, or lengthy test output.
- Update the brain before the mandatory local Git commit and stage it with the
  project work. Never push unless the user separately asks.

## Step 1 — Establish verified state

Read repository instructions and inspect the real project. Use Git to identify
the current branch, working changes, recent commits, and the latest commit that
changed `.sdlc/project-brain.md`. Read the existing brain when present.

Read only the project evidence needed to verify or correct it, prioritising:

- `requirements.md` for product goals and boundaries;
- `design-brief.md` and `plan.md` for design and architecture;
- `task-graph.md`, `project-plan.md`, and `.sdlc/progress.md` for work state;
- current source and tests for implemented behavior;
- review, QA, security, and deployment reports for open risks;
- Git history for when and why durable decisions changed.

If `.sdlc/context.md` exists and no Project Brain exists, read it once as
migration input. Copy only durable facts that still verify; do not reproduce
its session history.

## Step 2 — Write the bounded brain

Create `.sdlc/project-brain.md` with this shape, omitting empty detail rather
than inventing it:

```markdown
# Project Brain

> Verified: [UTC date/time]
> Git: [branch and current commit, or “not committed yet”]

## Product goal and boundaries

- Goal: [what the product lets its users accomplish]
- In scope: [durable boundaries]
- Out of scope: [explicit exclusions]
- Evidence: [relative paths]

## Architecture map

| Area | Responsibility | Evidence |
|---|---|---|
| [area] | [plain-language responsibility] | [path] |

## Durable decisions

| Decision | Why | Evidence |
|---|---|---|
| [decision] | [rationale or tradeoff] | [path or commit] |

## Current verified state

- Working now: [user-visible capabilities with evidence paths]
- In progress: [only genuinely active work]
- Not built or not verified: [important gaps]

## Open risks and questions

- [risk, blocker, or decision needed — owner and evidence]

## Next actions

1. [specific next safe action]

## Evidence map

- [path] — [why a future agent should read it]
```

The brain is an index, not a second copy of the repository. Prefer ten precise
paths over pasted code. Describe roadmap identifiers in plain product language;
keep the exact identifier only when it is needed to locate evidence.

## Step 3 — Self-check

Before finishing, confirm:

1. every cited path exists;
2. current-state claims match the source and latest relevant test evidence;
3. old or contradicted decisions were corrected, not silently preserved;
4. no sensitive or transcript content is present;
5. the file is no larger than 16 KB;
6. the Project Brain is staged in the same local commit as the verified work.

If the workspace has unrelated uncommitted changes, preserve them and stage
only the files belonging to this work. If the Project Brain cannot be made
trustworthy, mark the disputed claim as unverified and state the exact evidence
needed rather than guessing.

## Completion message

Tell the user, in one plain sentence, whether Lyra's project memory is current,
what it will remember, and whether any important project fact remains
unverified. Do not lead with filenames, hashes, or test counts.
