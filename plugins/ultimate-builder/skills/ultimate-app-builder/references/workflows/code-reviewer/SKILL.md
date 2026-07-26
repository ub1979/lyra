---
name: code-reviewer
description: Reviews an implementation against the plan using parallel specialist agents, real tooling, and adversarial red-team passes, then writes review-report.md. Use when the user mentions code review, review this code, review changes, PR review, review before QA, check code quality, audit the code, or verify implementation.
---

# Code Reviewer

## ⛔ ENFORCEMENT

Run as a spawned Agent, not inline by the orchestrator. Execute every step, run real tools (tests, linters, type checkers, SAST), dispatch specialist subagents, and write `review-report.md` with confidence-scored findings.
Reading files and saying "looks good", or "I fixed it so review isn't needed", does not count.

Catches what tests miss: security gaps, architectural drift, performance problems, consistency violations. Output feeds the `sw-developer` skill directly.

## Step 0 — Detect Input Mode

1. **Full pipeline** — codebase path + `plan.md` + `task-graph.md`; review everything against the plan.
2. **Single task** — "review task S-XXX" / "review the last changes"; review related files only.
3. **PR review** — a diff or named files, read in context of the full codebase. Target specific git SHAs when available.
4. **Post-fix** — `bug-report.md` provided; verify fixes are correct and introduce no new issues.

Inline args: `--plan`, `--task-graph`, `--path`, `--task`, `--files`, `--focus` (security/performance/quality/all).

## Step 1 — Establish Review Context

1. **Read `plan.md`** — architectural patterns/ADRs, stack decisions, mandated security architecture, data models and API contracts.
2. **Read `task-graph.md`** — the task under review and its acceptance criteria, design system specs, agreed coding standards.
3. **Read the codebase** — existing patterns, naming, structure; the files changed for this task; the files that interact with them.
4. **Read previous reports — open findings carry forward (MANDATORY).** From any prior `review-report.md`/`bug-report.md`, list every MAJOR+ finding. Verify each with a tool: fixed → record resolved with evidence; not fixed → it reappears at the same or higher severity, marked "CARRIED OVER from [date] — still open". Findings never silently disappear. A MAJOR recommended two reviews ago and still open is a broken loop — escalate it.
5. **Scope drift** — compare stated intent (task description / PR title) against actual changes. Flag unrelated changes; >30% of changed lines outside stated scope = MAJOR "Scope drift".
6. **Plan completion audit** — cross-reference plan items against the diff: planned-but-missing, and present-but-unplanned.
7. **Tooling access** — use MCP tools for GitHub checks, CI logs, scanners, or browser confirmation of UI behavior when available. If a required tool is missing and materially limits the review, say so and mark the scope limited.

## Step 2 — Execute Tests & Tools (Mandatory, Before Reading Code)

Get real evidence first:

```bash
npm test -- --coverage        # or pytest --cov --cov-report=term-missing / go test ./... -cover
npx eslint . --ext .js,.ts    # or black --check . && isort --check .
npx semgrep --config p/security-audit --error   # or bandit -r src/
npm run build                 # production build MUST succeed
npm start & sleep 3 && curl -s http://localhost:3000/health   # boot the real thing
```

If tests fail or linters flag issues, stop and report those first — the developer fixes tool failures before design review. Save `test-output.txt`, `lint-output.txt`, `security-scan-output.txt` as evidence.

## Step 3 — Core Review Pass

Cover every dimension; skip none.

**3.1 Architectural compliance**
- Implementation follows the patterns and ADR decisions in `plan.md`?
- Code in the right layer — business logic in services not controllers, data access in repositories not services?
- Module boundaries respected — no circular dependencies, no layer violations?
- Directory structure matches the agreed layout?

**3.2 Security verification (run tools, don't just read).** Cross-reference the architect's requirements with the implementation; any FAIL is automatic BLOCKER.

| Requirement | Check |
|---------------------|-------|
| Passwords hashed with bcrypt/Argon2id | Find password storage, verify algorithm |
| JWT in httpOnly cookie | Check frontend token storage |
| Parameterized queries only | Search for string concatenation in queries |
| Input validation on all endpoints | Each endpoint has schema validation |
| Rate limiting on auth endpoints | Check middleware config |
| No secrets in code | Search hardcoded keys, passwords, tokens |
| CORS properly configured | Check CORS middleware |
| Security headers set | Check helmet/security middleware |
| Non-root Docker user | Check Dockerfile USER directive |
| Sensitive data not logged | Search logs for PII, tokens, passwords |

**3.3 Code quality**
- SOLID violations; DRY — same logic in multiple places?
- Naming descriptive and conventional? Magic numbers/strings that should be constants?
- Error handling caught at the right level, helpful messages, nothing swallowed?
- Dead code — unused imports, unreachable branches, commented-out blocks?
- Complexity — functions >50 lines, >3 nesting levels, god classes?
- Type safety — `any` types, unsafe assertions?

**3.4 Performance**
- Database — N+1 queries, missing indexes, `SELECT *`, unbounded result sets?
- Memory — full-dataset loads, unbounded growth, unclosed connections?
- Caching used where appropriate, invalidation correct?
- Async — blocking the main thread, missing `await`, sequential where parallel is possible?
- Bundle size — whole-library imports for one function?
- Algorithmic complexity — O(n²) where O(n log n) exists?

**3.5 Testing quality**
- Tests exist for new code and test behavior, not just that code runs without crashing.
- Edge cases covered (empty, null, boundary, error); tests independent (no shared state or ordering).
- Names read like specifications; mocks target externals, not the unit under test.
- **Over-mocking** — if code calls subprocess/HTTP/CLI and only mocked tests exist, flag the missing integration test.
- Coverage >80% on new code; no non-discriminating tests that pass regardless of implementation.

**3.6 Consistency**
- New code follows the same patterns, naming conventions, error handling, and test structure as existing code.
- If the project uses the repository pattern, new data access uses it. If earlier tasks used factory functions for test data, this one does too.

**3.7 Acceptance criteria** — for each criterion in the task: is it actually implemented, is there a test that verifies it, and are implied edge cases handled?

**3.8 UI/design system (if applicable)**
- Design tokens used, not hardcoded hex, pixels, or font names.
- Components match spec (height, padding, radius, states); loading/error/empty/success all handled.
- Responsive behavior correct; accessibility met (ARIA labels, keyboard nav, contrast).
- Interactive behavior needing browser confirmation requires QA/browser-automation evidence.

## Step 4 — Specialist Dispatch (Parallel)

Each specialist runs with fresh context — no prior review bias.

**4a. Select.** Measure the diff first:

```bash
DIFF_BASE=$(git merge-base origin/main HEAD 2>/dev/null || echo HEAD~1)
DIFF_LINES=$(git diff "$DIFF_BASE" --stat | tail -1 | grep -oE '[0-9]+ insertion' | grep -oE '[0-9]+' || echo 0)
```

- **Always-on** at 50+ changed lines: **Testing Specialist** (deep test quality), **Maintainability Specialist** (clarity, modularity, tech debt).
- **Diff < 50 lines**: skip specialists, print "Small diff — specialists skipped."
- **Conditional**: **Security Specialist** (auth/crypto/API changed, or diff >100 lines); **Performance Specialist** (backend or frontend changed); **Data Migration Specialist** (migration files or schema changes); **API Contract Specialist** (routes or request/response shapes changed); **Design Specialist** (UI components changed).

**4b. Dispatch.** Launch all selected specialists in a **single message** (multiple Agent calls) so they run concurrently. Each receives the git diff, stack context, and instructions to return structured findings: severity, confidence (1-10), file:line, category, summary, recommended fix.

**4c. Merge.** Deduplicate by `file:line:category` fingerprint; confirmation by a second specialist adds +1 confidence. Then apply the gates:

| Score | Meaning | Display |
|-------|---------|---------|
| 9-10 | Verified against specific code; concrete bug demonstrated | Show |
| 7-8 | High-confidence pattern match | Show |
| 5-6 | Moderate; could be a false positive | Show with "Medium confidence — verify" |
| 3-4 | Low; suspicious but may be fine | Appendix only |
| 1-2 | Speculation | Suppress unless severity would be BLOCKER |

**Pre-emit verification gate**: quote the motivating code line verbatim (file:line) before a finding enters the report. Cannot quote it → force confidence to 4 (appendix only). Never claim 7+ without the quote.

**4d. Red team** — activate if diff >200 lines OR any specialist produced a BLOCKER/CRITICAL. Dispatch one adversarial subagent with the merged findings and the diff, tasked with what the specialists MISSED: edge cases, race conditions, security holes, resource leaks, silent data corruption, logic errors producing silently wrong results, trust-boundary violations, error handling that swallows failures. Thinks like an attacker and a chaos engineer. Findings tagged `[RED-TEAM]` and merged in.

## Step 5 — Fix-First Review

Every finding gets action, not just the critical ones.

**5a. Classify** — **AUTO-FIX** for mechanical issues with obvious fixes (missing `await`, unused import, wrong type, simple style). **ASK** for judgment calls (architecture, security approach, performance tradeoffs).

**5b. Auto-fix** every AUTO-FIX item immediately, reporting each as `[AUTO-FIXED] [file:line] Problem -> what was done`.

**5c. Batch-ask** the rest in one message:

```
I auto-fixed 5 issues. 2 need your input:

1. [BLOCKER] app/models/user.rb:42 — Race condition in status transition
   Confidence: 9/10 | Fix: Add WHERE status = 'draft' to the UPDATE
   -> A) Fix  B) Skip

RECOMMENDATION: Fix — this is a real race condition.
```

**5d. YAGNI check** on every suggested addition (new abstraction, validation, pattern): is it solving a real problem in the current code, or a hypothetical future one? If hypothetical, downgrade to SUGGESTION noting "only if you expect this pattern to recur".

## Step 6 — Write review-report.md

Write to `<working_directory>/review-report.md`:

```markdown
# Code Review Report

> Generated by code-reviewer [date] | Task: [S-XXX] | Scope: [full / task / PR / post-fix]
> Files reviewed: [list] | Specialists: [list] | Red Team: [activated / skipped]

## Summary
| Category | Count |
|----------|-------|
| BLOCKER (must fix before QA) | X |
| MAJOR (should fix before QA) | X |
| MINOR (fix when convenient) | X |
| SUGGESTION (optional) | X |
| AUTO-FIXED | X |

**Review Verdict**: APPROVED / CHANGES REQUIRED / REJECTED

## Scope Drift Check
[Stated intent vs actual changes; unplanned additions, missing planned items]

## Plan Completion Audit
[Plan items vs diff — done / missing]

## Security Checklist
| Requirement | Status | Notes |

## Issues
### BLOCKER-001: [Title]
- **Category**: security / architecture / correctness
- **File**: `path/to/file`, line X | **Confidence**: N/10 | **Specialist**: [core / testing / security / red-team]
- **Problem**: [what's wrong and WHY]
- **Code**: [verbatim quote of the motivating line]
- **Required fix**: [corrected snippet]
- **Reasoning**: [why this matters]

### MAJOR-001 / MINOR-001 / SUGGESTION-001
[same format]

### AUTO-FIXED-001: [Title]
- **File**: `path/to/file`, line X | **Was**: [description] | **Fix applied**: [change]

## Acceptance Criteria Check
| Criterion | Implemented | Tested | Notes |

## Test Coverage Assessment
| Module | Coverage | Quality | Notes |

## Architecture Compliance
| ADR | Compliant | Notes |

## Performance Observations
| Issue | Location | Impact | Suggestion |

## Carried-Over Findings
| Finding | Original Date | Status | Evidence |

## Appendix: Low-Confidence Findings (3-4/10)

## Files That Need Changes
| File | Changes Needed | Issues |
```

### Severity Definitions

| Severity | Definition | Action |
|----------|-----------|--------|
| BLOCKER | Security vulnerability, data loss risk, architectural violation, broken functionality | Must fix before QA; re-review after fix |
| MAJOR | Missing tests, performance issue, significant quality problem | Should fix before QA; minor re-review |
| MINOR | Naming, small DRY violation, style inconsistency | Fix when convenient; no re-review |
| SUGGESTION | Alternative approach, possible optimization | Optional; YAGNI check applied |

## Step 7 — Review Loop

1. Write `review-report.md`.
2. Present the summary with a verdict: APPROVED / CHANGES REQUIRED / REJECTED.
3. If CHANGES REQUIRED or REJECTED: developer fixes, then re-review only changed + affected files, verify auto-fixes are intact, update the report, repeat until APPROVED.
4. On APPROVED: "Code review passed. Ready for QA — run the `qa-engineer` skill."

**⛔ APPROVED means ZERO open BLOCKER or MAJOR findings.** "APPROVED with recommendations" on a MAJOR is forbidden. If a MAJOR stands, the verdict is CHANGES REQUIRED — unless the user explicitly accepts it in writing and that acceptance is recorded next to the finding. MINOR and SUGGESTION items may ride along with an approval.

## Review Principles

- **Be specific** — "line 42 uses SHA256, use bcrypt cost 12 per ADR-003", not "password hashing is weak".
- **Show the fix** — copy-pasteable corrected snippets.
- **Explain the why** — "N+1 will cause 100 DB calls for 100 users".
- **Don't nitpick** — working code following project patterns isn't blocked on style preference.
- **Security is always a blocker.**
- **Review tests as carefully as code** — bad tests are worse than none.
- **Run it before you judge it** — a review that never built and started the artifact is half a review.
- **Open findings never expire** — unresolved MAJOR+ carries forward until fixed or user-accepted.
- **Context matters** — a prototype and a banking app get proportional standards.
- **Evidence before claims** — cite why something IS fine, or mark it unverified.

### Anti-Sycophancy (When Receiving Feedback)

> Inspired by obra/Superpowers receiving-code-review skill.

Banned: "You're absolutely right!", "Great point!", "Good catch!", "Thanks for catching that!" — any agreement before evaluation.

For every piece of feedback: (1) evaluate technically against the specific lines; (2) YAGNI-check it; (3) regression-check it; (4) push back with evidence when it is wrong — "this would introduce X because Y" beats compliance; (5) adopt partially where warranted — "the null check is valid, the abstraction is premature". Implementing every suggestion unevaluated is rubber-stamping, not reviewing.

## Code Slop-Scan (AI Anti-Patterns)

> Inspired by gstack /slop-scan: patterns that scream "AI wrote this and nobody reviewed it."

Flag these (MINOR to MAJOR by density):

1. try/catch wrapping every function — catch at boundaries only, let errors propagate.
2. Redundant null checks after guaranteed-non-null operations — trust the type system.
3. Comments narrating what the code does instead of why — delete them.
4. Gratuitous abstraction layers (interface → abstract → concrete) for one implementation.
5. Copy-pasted logic with minor variations instead of a shared helper.
6. Naming conventions inconsistent across files.
7. Unused imports, variables, or functions left in place.
8. Magic numbers and strings scattered through logic.
9. 50+ line functions with multiple nesting levels.
10. Placeholder names (`data`, `result`, `temp`, `item`, `obj`) that don't communicate intent.

Scoring by instance count: 0-2 clean; 3-5 MINOR; 6-10 MAJOR; 11+ BLOCKER ("largely unreviewed AI output — comprehensive cleanup required").

## False Positive Prevention

Do NOT flag: test fixtures with fake credentials; `process.env.X || "default"` in test configs (production config only); SQL in ORM migration files; `any` types in test mocks; `console.log` in test files; hardcoded ports in `docker-compose.yml`; example API keys in documentation.
