---
name: health
description: Code health dashboard — runs linter, type checker, tests, dead-code detection, and dependency audit; produces a composite 0-10 score and tracks it over time. Use when the user mentions: health check, code health, code quality, quality score, tech debt, code audit.
---

# Code Health Dashboard

Produces a composite health score (0-10) by running real tools across multiple quality dimensions. Tracks scores over time so you can detect regressions.

---

## ⛔ ENFORCEMENT: EVERY SCORE MUST COME FROM TOOL OUTPUT

> Do not estimate or guess scores. Every dimension is scored by running a tool and reading its output.
> "Looks clean" is not a score. "`eslint` reports 0 errors" is a score.

---

## Step 1 — Detect Stack

Identify the project's language, framework, and available tooling:

```bash
ls package.json requirements.txt go.mod Cargo.toml pyproject.toml 2>/dev/null
cat package.json | grep -E '"(eslint|prettier|jest|vitest|typescript)"' 2>/dev/null
```

Map each dimension to the right tool for this stack.

---

## Step 2 — Run All Dimensions

### Dimension 1: Linting (Weight: 20%)

```bash
# Node.js
npx eslint . --ext .js,.ts,.tsx --format json 2>/dev/null | jq '.[] | .errorCount' | paste -sd+ | bc
# Python
python -m ruff check . --statistics 2>/dev/null || python -m flake8 . --count 2>/dev/null
# Go
golangci-lint run --out-format json 2>/dev/null
```

| Score | Criteria |
|-------|----------|
| 10 | 0 errors, 0 warnings |
| 8 | 0 errors, <10 warnings |
| 6 | <5 errors, <20 warnings |
| 4 | <20 errors |
| 2 | <50 errors |
| 0 | 50+ errors or linter not configured |

### Dimension 2: Type Safety (Weight: 15%)

```bash
# TypeScript
npx tsc --noEmit 2>&1 | grep -c 'error TS'
# Python
python -m mypy . --ignore-missing-imports 2>&1 | grep -c 'error:'
# Go (built-in)
go vet ./... 2>&1 | grep -c 'error'
```

| Score | Criteria |
|-------|----------|
| 10 | 0 type errors, strict mode enabled |
| 8 | 0 type errors, standard mode |
| 6 | <5 type errors |
| 4 | <20 type errors |
| 2 | <50 type errors |
| 0 | 50+ type errors or no type checking |

### Dimension 3: Test Suite (Weight: 25%)

```bash
# Run tests with coverage
npm test -- --coverage 2>&1
# or: pytest --cov --cov-report=term-missing
# or: go test ./... -cover
```

| Score | Criteria |
|-------|----------|
| 10 | All pass, >90% coverage |
| 8 | All pass, >80% coverage |
| 6 | All pass, >60% coverage |
| 4 | All pass, <60% coverage |
| 2 | Some failures |
| 0 | Suite broken or no tests |

### Dimension 4: Dead Code (Weight: 10%)

```bash
# TypeScript/JavaScript
npx ts-prune 2>/dev/null | grep -c 'unused'
npx knip 2>/dev/null
# Python
python -m vulture . 2>/dev/null | wc -l
# General
grep -rn 'TODO\|FIXME\|HACK\|XXX' src/ | wc -l
```

| Score | Criteria |
|-------|----------|
| 10 | 0 unused exports, 0 TODOs |
| 8 | <5 unused exports, <5 TODOs |
| 6 | <10 unused exports, <10 TODOs |
| 4 | <25 unused exports or TODOs |
| 2 | <50 |
| 0 | 50+ dead code items |

### Dimension 5: Dependency Health (Weight: 15%)

```bash
# Node.js
npm audit --json 2>/dev/null | jq '.metadata.vulnerabilities'
npx npm-check 2>/dev/null | grep -c 'MISSING\|NOTUSED'
# Python
pip-audit 2>/dev/null | grep -c 'vulnerability'
# General
cat package-lock.json 2>/dev/null | jq '.packages | length' # total deps
```

| Score | Criteria |
|-------|----------|
| 10 | 0 vulnerabilities, 0 unused deps, all up to date |
| 8 | 0 critical/high vulns, <3 outdated |
| 6 | 0 critical vulns, some high |
| 4 | <3 critical vulns |
| 2 | Multiple critical vulns |
| 0 | Audit broken or not configured |

### Dimension 6: Build Health (Weight: 15%)

```bash
# Production build
time npm run build 2>&1
# Check bundle size (if applicable)
du -sh dist/ build/ .next/ 2>/dev/null
```

| Score | Criteria |
|-------|----------|
| 10 | Build passes, <30s, reasonable bundle size |
| 8 | Build passes, <60s |
| 6 | Build passes, <120s or large bundle |
| 4 | Build passes with warnings |
| 2 | Build passes with errors suppressed |
| 0 | Build fails |

---

## Step 3 — Calculate Composite Score

```
composite = (lint × 0.20) + (types × 0.15) + (tests × 0.25) + (dead_code × 0.10) + (deps × 0.15) + (build × 0.15)
```

### Grade Scale

| Score | Grade | Meaning |
|-------|-------|---------|
| 9.0-10.0 | A | Excellent — production-ready, well-maintained |
| 7.0-8.9 | B | Good — minor issues, generally healthy |
| 5.0-6.9 | C | Acceptable — needs attention, tech debt accumulating |
| 3.0-4.9 | D | Poor — significant quality issues |
| 0.0-2.9 | F | Critical — major intervention needed |

---

## Step 4 — Trend Analysis

If previous reports exist in `.sdlc/health-report.md`:

1. Extract the previous composite score and per-dimension scores
2. Calculate deltas
3. Flag regressions (any dimension that dropped >1 point)
4. Flag improvements (any dimension that gained >1 point)

```
Trend: 7.2 → 8.1 (+0.9) — improving
  Tests: 6 → 8 (+2) — coverage improved
  Deps: 8 → 6 (-2) — new vulnerabilities found ⚠️
```

---

## Step 5 — Write .sdlc/health-report.md

```bash
mkdir -p .sdlc
```

```markdown
# Code Health Report

> Date: [date]
> Project: [name]
> Composite Score: [X.X] / 10 — Grade: [A-F]

## Score Breakdown

| Dimension | Score | Weight | Weighted | Evidence |
|-----------|-------|--------|----------|----------|
| Linting | X/10 | 20% | X.X | [X errors, Y warnings] |
| Type Safety | X/10 | 15% | X.X | [X type errors] |
| Test Suite | X/10 | 25% | X.X | [X/Y passing, Z% coverage] |
| Dead Code | X/10 | 10% | X.X | [X unused, Y TODOs] |
| Dependencies | X/10 | 15% | X.X | [X vulns, Y outdated] |
| Build | X/10 | 15% | X.X | [build time, bundle size] |
| **Composite** | **X.X** | | | |

## Trend

| Date | Score | Delta | Notable Changes |
|------|-------|-------|-----------------|
| [previous] | X.X | — | — |
| [current] | X.X | +/-X.X | [what changed] |

## Top Issues

1. [Most impactful issue with fix suggestion]
2. [Second issue]
3. [Third issue]

## Recommendations

- [Actionable improvement with expected score impact]
```

---

## Step 6 — Summary

Present a one-line summary:

> "Health score: [X.X]/10 (Grade [A-F]). Top issue: [issue]. Run `/health` again after fixes to track improvement."
