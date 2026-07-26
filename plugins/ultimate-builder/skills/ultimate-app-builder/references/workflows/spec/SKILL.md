---
name: spec
description: Lightweight spec-to-issue pipeline — clarifies a vague idea into a precise spec, optionally files a GitHub issue; lighter than req-engineer, for single features or bugs. Use when the user mentions: spec this, write a spec, file an issue, quick spec, feature request, ticket this.
---

# Spec — Idea to Issue Pipeline

Takes a vague idea and refines it into a precise, actionable spec in 5 phases. Optionally files it as a GitHub issue. Lighter than `req-engineer` — use this for individual features, bugs, or improvements.

---

## When to Use This vs req-engineer

| Use `spec` | Use `req-engineer` |
|------------|-------------------|
| Single feature or bug | Entire new project |
| Quick ticket needed | Full requirements document |
| "I want to add X" | "Build me an app that does Y" |
| 5-15 minutes | 30-60 minutes |
| Outputs: spec.md or GitHub issue | Outputs: requirements.md |

---

## Phase 1 — Intent (Capture the Raw Idea)

Listen to the user's description. Extract:

- **What** they want (feature, fix, improvement, refactor)
- **Why** they want it (user need, bug impact, tech debt)
- **Who** it affects (end users, developers, ops)

If the description is too vague to act on, ask **at most 3 clarifying questions** — all in one batch:

```
Before I spec this out, I need to clarify:
1. [specific question about scope]
2. [specific question about behavior]
3. [specific question about constraints]
```

Do not ask more than 3 questions. For anything unspecified, make a sensible default and note it as an assumption in the spec.

---

## Phase 2 — Scope (Define Boundaries)

Write down explicitly:

- **In scope**: what this spec covers
- **Out of scope**: what it deliberately excludes
- **Assumptions**: defaults you chose because the user didn't specify
- **Dependencies**: what must exist before this can be built

If the feature touches existing code, read the relevant files to understand the current state:

```bash
# Find relevant files
grep -rn "relevant-keyword" src/ --include="*.ts" --include="*.py" | head -20
```

---

## Phase 3 — Spec (Write the Specification)

Write a precise spec with these sections:

```markdown
# Spec: [Title]

## Summary
[One paragraph — what, why, who]

## Current Behavior
[What happens now — with code references if applicable]

## Desired Behavior
[What should happen — specific, testable, unambiguous]

## Acceptance Criteria
- [ ] [Given/When/Then or specific measurable criterion]
- [ ] [criterion 2]
- [ ] [criterion 3]

## Technical Approach (Optional)
[Suggested implementation if you read the code and have an opinion]

## Scope
- **In**: [what's included]
- **Out**: [what's excluded]

## Assumptions
- [assumption 1 — chose X because user didn't specify]

## Dependencies
- [what must exist first]

## Effort Estimate
- Complexity: S / M / L
- Files likely affected: [list]
```

**Rules:**
- Acceptance criteria must be testable — no "should be fast" without a number
- If you read the code, reference specific files and functions
- Every assumption is flagged so the user can override it
- Effort estimate uses the same S/M/L tiers as task-planner

---

## Phase 4 — Review (Self-Check)

Before presenting, verify:

1. **Completeness**: can a developer read this spec and implement it without asking questions?
2. **Testability**: can QA write tests from the acceptance criteria alone?
3. **Scope clarity**: is it clear what's in and out?
4. **No placeholders**: no TBD, TODO, or "to be determined"
5. **No vague criteria**: no "should be fast", "user-friendly", "responsive" without numbers

If any check fails, fix it before presenting.

---

## Phase 5 — Ship (Deliver the Spec)

Present the spec to the user and ask:

```
Spec ready. What should I do with it?

A) Save as spec.md in the project
B) File as a GitHub issue
C) Both — save locally and file an issue
D) Just show me — I'll handle it
```

### If filing a GitHub issue:

```bash
# Detect remote
REMOTE=$(git remote get-url origin 2>/dev/null)

# Create issue
gh issue create \
  --title "[type]: [title]" \
  --body "$(cat spec.md)" \
  --label "enhancement" \
  2>/dev/null
```

Use appropriate labels:
- `enhancement` for features
- `bug` for bug fixes
- `refactor` for tech debt
- `documentation` for docs

### If saving locally:

Write to `spec.md` in the project root (or `specs/[slug].md` if a `specs/` directory exists).

---

## Output

After shipping:

> "Spec complete: [title] ([complexity]). [Filed as issue #X / Saved to spec.md]. [N] acceptance criteria, [M] files likely affected."
