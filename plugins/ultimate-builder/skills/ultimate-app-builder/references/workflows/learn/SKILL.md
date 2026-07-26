---
name: learn
description: Records and retrieves cross-session learnings in .sdlc/learnings.jsonl — patterns, pitfalls, decisions, conventions. Use when the user mentions: learn, record this, remember this pattern, lesson learned, pitfall, note this convention.
---

# Learn — Cross-Session Knowledge

Maintains a searchable JSONL file of learnings that compound across sessions. Each entry captures a pattern, pitfall, decision, or convention with enough context to be useful months later.

---

## Recording a Learning

### Step 1 — Classify

Determine the category:

| Category | When to Use | Example |
|----------|------------|---------|
| `pattern` | A reusable approach that worked well | "Use Zod schemas at API boundary for runtime validation" |
| `pitfall` | Something that caused a bug or wasted time | "Next.js App Router doesn't support `req.body` in route handlers without explicit parsing" |
| `decision` | A deliberate choice with rationale | "Chose Drizzle over Prisma for this project because of edge runtime support" |
| `convention` | A project-specific standard | "All API responses use `{ data, error, meta }` envelope" |

### Step 2 — Write the Entry

Append one JSON line to `.sdlc/learnings.jsonl`:

```bash
mkdir -p .sdlc
```

```json
{
  "date": "2026-06-21",
  "project": "project-name",
  "category": "pitfall",
  "summary": "One-line description searchable by keyword",
  "detail": "Full explanation with context — what happened, why, and what to do differently",
  "files": ["src/api/route.ts", "src/middleware/auth.ts"],
  "tags": ["nextjs", "api", "parsing"]
}
```

**Rules:**
- `summary` must be searchable — include the technology, the symptom, and the fix in one line
- `detail` must be self-contained — a reader with no context should understand the lesson
- `files` lists the files where this learning applies (empty array if general)
- `tags` are lowercase keywords for search
- One learning per entry — don't bundle unrelated lessons

### Step 3 — Confirm

After appending:

> "Learned: [summary]. Stored in `.sdlc/learnings.jsonl` ([N] total entries)."

---

## Retrieving Learnings

### On Session Start

When beginning work on a project, search for relevant learnings:

```bash
# Search by project name
grep -i "project-name" .sdlc/learnings.jsonl 2>/dev/null

# Search by technology
grep -i "nextjs\|react\|fastapi" .sdlc/learnings.jsonl 2>/dev/null

# Search by category
grep '"pitfall"' .sdlc/learnings.jsonl 2>/dev/null

# Search by file path
grep "src/api" .sdlc/learnings.jsonl 2>/dev/null
```

Present relevant findings:

> "Found [N] relevant learnings for this project:
> - [pitfall] [summary] ([date])
> - [pattern] [summary] ([date])"

### On Debugging

Before hypothesizing, check if this bug pattern has been seen before:

```bash
grep -i "keyword-from-error" .sdlc/learnings.jsonl 2>/dev/null
```

If a matching pitfall exists, apply it before trying other hypotheses.

---

## Auto-Learn Triggers

The orchestrator (idk_it) should call this skill automatically when:

1. **A debugging session resolves** — record the root cause as a pitfall
2. **A code review finds a recurring pattern** — record it as a convention
3. **An architectural decision is made** — record the rationale as a decision
4. **A workaround is applied** — record it as a pitfall with the workaround

---

## Quality Standards

- Never record obvious things ("use git for version control")
- Every entry must be specific enough to be actionable
- Pitfalls must include both the symptom AND the fix
- Decisions must include the alternatives considered and why they were rejected
- Don't duplicate — search before recording. If a similar entry exists, update it instead
