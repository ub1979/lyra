---
name: context-save
description: Saves working context (git state, decisions, remaining work, key paths) to .sdlc/context.md so the next session resumes instantly. Use when the user mentions: save context, save progress, checkpoint, wrap up, session end, pause work, save state.
---

# Context Save

Captures the current working context and writes it to `.sdlc/context.md` for seamless session continuity. The next session reads this file to resume exactly where you left off.

---

## When to Use

- End of a work session
- Before switching to a different project
- After completing a major milestone
- When the user says "save progress" or "I'm done for now"
- Automatically suggested by the orchestrator after completing a pipeline phase

---

## Step 1 — Gather Context

Collect all of the following. Use tools — do not guess or rely on memory.

### 1.1 Git State

```bash
git branch --show-current
git status --short
git log --oneline -5
git stash list
```

Record: current branch, uncommitted changes, recent commits, any stashes.

### 1.2 Decisions Made This Session

Scan the conversation for decisions:
- Architecture choices ("we chose X over Y because...")
- Design decisions ("the color palette is...", "we're using pattern X")
- Scope decisions ("we're deferring X", "MVP includes Y but not Z")
- Technical tradeoffs ("using library A instead of B because...")

### 1.3 Work Completed

- Which pipeline phases ran (requirements, architecture, planning, development, etc.)
- Which tasks/stories were completed
- Which files were created or modified
- Test results (pass/fail counts)
- Review verdicts

### 1.4 Remaining Work

- Next task in the plan (by ID if available)
- Blocked items and what unblocks them
- Known bugs or issues found but not yet fixed
- Deferred items with reason

### 1.5 Open Questions

- Unanswered questions from requirements or reviews
- Decisions that need user input
- Ambiguities in the spec

### 1.6 Key File Paths

- All generated documents: requirements.md, plan.md, task-graph.md
- Source directories
- Test directories
- Config files
- Reports: review-report.md, bug-report.md, security-report.md

---

## Step 2 — Write .sdlc/context.md

```bash
mkdir -p .sdlc
```

Write to `.sdlc/context.md`:

```markdown
# Session Context

> Saved: [date and time]
> Branch: [current branch]
> Project: [project name from plan.md or directory name]

## Git State

- Branch: `[branch]`
- Uncommitted changes: [list or "none"]
- Recent commits:
  - [hash] [message]
  - [hash] [message]
- Stashes: [list or "none"]

## Decisions Made

| Decision | Rationale | Date |
|----------|-----------|------|
| [what was decided] | [why] | [when] |

## Work Completed

### Pipeline Phases
- [x] Requirements — requirements.md
- [x] Architecture — plan.md
- [ ] Planning — task-graph.md (not started)
- ...

### Tasks Completed
| Task | Status | Files | Evidence |
|------|--------|-------|----------|
| T-001: [title] | Done | [files] | Tests pass |

## Remaining Work

### Next Up
- [ ] T-XXX: [title] — [brief description]

### Blocked
- [ ] T-XXX: [title] — blocked by [reason]

### Deferred
- [ ] [item] — deferred because [reason]

## Open Questions

1. [question] — needs input from [who]

## Key Files

| File | Purpose | Status |
|------|---------|--------|
| requirements.md | Requirements | Complete |
| plan.md | Architecture | Complete |
| task-graph.md | Task breakdown | In progress |
| src/ | Source code | [X files] |
| tests/ | Tests | [X passing] |

## Resume Instructions

To continue this work:
1. Read this file first
2. Then read: [list of key docs to read]
3. Start with: [specific next action]
```

---

## Step 3 — Idempotency

If `.sdlc/context.md` already exists:
1. Read the existing file
2. Preserve the "Decisions Made" table — append new decisions, don't overwrite
3. Update all other sections with current state
4. Add a "Previous Sessions" section at the bottom with a one-line summary of each prior save

---

## Step 4 — Confirm

After writing, present a one-line summary:

> "Context saved to `.sdlc/context.md`. Resume next session by reading that file. [X] decisions recorded, [Y] tasks remaining, next up: [task]."

---

## Quality Standards

- Every field must be filled with real data from tools, not placeholders
- Git state must come from actual `git` commands, not memory
- File paths must be verified to exist
- Task IDs must match the plan if one exists
- The "Resume Instructions" section must be specific enough that a fresh agent can pick up the work without asking questions
