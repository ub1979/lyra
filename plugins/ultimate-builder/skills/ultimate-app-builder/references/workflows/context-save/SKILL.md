---
name: context-save
description: Creates, repairs, condenses, or audits the bounded Project Brain at .sdlc/project-brain.md for context recovery and handoff.
---

# Project Brain

Maintain a compact, verified retrieval map so Lyra can resume a project without
loading the full conversation or trusting stale notes.

Use this skill after a meaningful verified milestone, before context
compression, when handing work to another agent, when the user asks to save
progress, or when the existing memory is stale or oversized. Do not rewrite the
file after every small action.

## Rules

- Target `.sdlc/project-brain.md`.
- Keep it under 16 KB.
- Verify material claims against current files, tests, or Git history.
- Preserve durable decisions and their rationale. Replace stale status and next
  actions instead of appending a session diary.
- Store compact project-relative evidence paths and useful Git commit ids.
- Never store secrets, credentials, personal data, full source files, raw chat
  transcripts, or lengthy test output.
- Project Brain helps retrieval. It does not prove that the application works.

## Gather verified state

Inspect the repository instructions, Git status and recent history. Read the
existing brain when present. Read only the evidence needed to confirm or correct
it, normally:

- `requirements.md` for the product goal and boundaries;
- `design-brief.md` and `plan.md` for design and architecture;
- `task-graph.md`, `project-plan.md`, and `.sdlc/progress.md` for work state;
- current source and tests for implemented behaviour;
- review, QA, security, and deployment reports for open risks.

If `.sdlc/context.md` exists and no Project Brain exists, use it once as
migration input. Keep only durable facts that still verify.

## Write the retrieval map

Use this structure and omit empty sections rather than inventing content:

```markdown
# Project Brain

> Verified: [UTC date/time]
> Git: [branch and current commit, or "not committed yet"]

## Product goal and boundaries

- Goal: [what users can accomplish]
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

- Working now: [capabilities with evidence paths]
- In progress: [genuinely active work]
- Not built or not verified: [important gaps]

## Open risks and questions

- [risk, blocker, or decision needed, with evidence]

## Next actions

1. [specific next safe action]

## Evidence map

- [path] — [why a future agent should read it]
```

Before finishing, confirm that cited paths exist, status claims match current
evidence, contradicted decisions were corrected, no sensitive content is
present, and the file is no larger than 16 KB. If a claim cannot be verified,
label it as unverified and name the evidence needed.

Tell the user in one plain sentence whether the memory is current, what it will
remember, and whether an important project fact remains unverified.
