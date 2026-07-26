---
name: debugger
description: Systematic root cause analysis in 5 phases — evidence collection, pattern matching, hypothesis testing, implementation, verification — with git bisect, minimal reproduction, and regression tests. Use when the user mentions: debug, bug, root cause, investigate, regression, error, crash, broken, not working, unexpected behavior.
---

# Debugger

**ENFORCEMENT**: The orchestrator MUST spawn this as a dedicated Agent — never "look at the error" and guess a fix itself.
The spawned agent executes all 5 phases: root cause identified with evidence, regression test written, fix verified. No shortcuts.

Systematic root cause analysis: observe first, hypothesize second, verify third. Output: a fix for the root cause (not symptoms), a regression test that would have caught the bug, and a learnings entry.

---

## HARD RULES

1. **Observe, don't assume** — add logging/instrumentation BEFORE changing code.
2. **Root cause, not symptoms** — suppressing or catching-to-hide an error is not a fix. If you can't explain WHY the bug happens, you haven't found it.
3. **3-strike rule** — max 3 hypotheses. Third one wrong? STOP: re-examine assumptions from scratch or escalate. Guessing introduces new bugs.
4. **Scope freeze** — don't edit unrelated files. Debugging is not refactoring.
5. **Regression test is mandatory** — fails without the fix, passes with it. If impossible, document why and what manual verification was done.
6. **"It works now" without WHY is not fixed** — an unexplained disappearance will return. Understand the mechanism.
7. **Minimal reproduction first** — smallest test case that triggers the bug; proves you understand the trigger and gives a fast feedback loop.

---

## Phase 1 — Evidence Collection

Gather ALL evidence before forming any hypothesis.

### 1.1 Error Context
```bash
tail -100 logs/error.log
grep -rn "ERROR\|WARN\|FATAL\|Exception\|Traceback" logs/ | tail -50
df -h; free -m; ulimit -a   # disk / memory / fd limits
```

### 1.2 Reproduction
Reproducible consistently? EXACT trigger steps? All environments or one? When did it start (deployment history)?

### 1.3 Recent Changes
```bash
git log --oneline -20
git diff HEAD~5..HEAD -- src/
git log --oneline -- "*.env*" "*.yml" "*.yaml" "*.json" "*.toml" "*.cfg"
```

### 1.4 Environment Diff
Working vs. broken: package versions, OS, config, database state.

**Output**: structured evidence summary — known, unknown, suspicious.

---

## Phase 2 — Pattern Matching

### 2.1 Common Patterns
| Pattern | Symptoms | Check |
|---------|----------|-------|
| Race condition | Intermittent, timing-dependent, works under debugger | Timestamped logging, shared mutable state |
| Resource leak | Gradual degradation, fails after time/load | Unclosed connections, file handles, listeners |
| Off-by-one | Fails at boundaries | Loop bounds, indices, pagination offsets |
| Null/undefined | Crashes on specific data paths | Optional chaining, null guards, empty collections |
| State corruption | Wrong behavior after specific action sequence | State mutations, event ordering, cache invalidation |
| Encoding issue | ASCII works, unicode fails | Encoding at system boundaries (DB, API, filesystem) |
| Dependency change | Broke after update, no code changes | Lockfile diff, changelog breaking changes |
| Configuration drift | Works locally, fails in production | Diff all config between environments |
| Memory exhaustion | OOM, growing memory | Unbounded caches, large retention, missing pagination |
| Deadlock | Hangs forever, no error | Lock ordering, async chains, transaction nesting |

### 2.2 Git Bisect (for regressions)
If it used to work:
```bash
git bisect start; git bisect bad HEAD; git bisect good <last-known-good>
# run the reproduction at each step; git bisect good/bad
```
Gives the EXACT commit that introduced the bug.

### 2.3 Check Learnings
```bash
grep -i "<keyword>" .sdlc/debug-learnings.jsonl 2>/dev/null
```

**Output**: top 1-3 hypotheses ranked by evidence strength; each must explain ALL observed symptoms.

---

## Phase 3 — Hypothesis Testing

Test with MINIMAL instrumentation — observation only, no behavior changes.

### 3.1 Testing Protocol
For each hypothesis (max 3):
1. State it: "The bug occurs because X happens when Y is true"
2. Predict observable behavior: "If correct, we'll see Z in the logs"
3. Add instrumentation (logging, breakpoints, assertions) — NOT code changes
4. Run the reproduction
5. Compare prediction vs. reality

### 3.2 Decision Matrix
| Evidence | Matches | Partially matches | Contradicts |
|----------|---------|-------------------|-------------|
| **Action** | Proceed to Phase 4 | Refine hypothesis | Discard, try next |

### 3.3 The 3-Strike Escalation
After 3 failed hypotheses: STOP modifying code; document what was tried and revealed; re-examine assumptions (right component?); escalate to the user with evidence and the broader area the bug may be in — ask whether to widen the investigation. Do NOT keep guessing.

---

## Phase 4 — Implementation

Fix the ROOT CAUSE, not the symptom.

### 4.1 Fix Criteria
- [ ] Addresses the root cause from Phase 3
- [ ] Minimal — changes only what's necessary
- [ ] No error suppression, hidden exceptions, or workarounds
- [ ] Includes regression test (4.2)
- [ ] Breaks no existing tests

### 4.2 Regression Test (MANDATORY)
The test must: FAIL without the fix, PASS with it, and cover the exact trigger condition.
```bash
git stash && npm test -- --grep "bug X"   # must FAIL
git stash pop && npm test -- --grep "bug X"   # must PASS
```

### 4.3 Scope Check
Only bug-related files modified? No "cleanup" of nearby code? Revert any unrelated changes.

---

## Phase 5 — Verification

Prove the fix works AND nothing else broke.

### 5.1 Direct Verification
Run the original reproduction (bug gone) and the regression test.

### 5.2 Blast Radius Check
```bash
npm test                # full suite
npx eslint . --ext .ts,.js
npm run build
npm start & sleep 3; curl -s http://localhost:3000/health   # smoke
```

### 5.3 Root Cause Explanation
Write: what was happening, why (mechanism), what the fix does, why it won't recur (regression test coverage). Can't write this? You haven't found the root cause — back to Phase 2.

---

## Phase 6 — Record Learnings

Append to `.sdlc/debug-learnings.jsonl`:
```json
{"date": "...", "bug": "one-line", "root_cause": "mechanism",
 "pattern": "race-condition|resource-leak|off-by-one|null-ref|state-corruption|encoding|dependency|config|memory|deadlock|other",
 "files": ["..."], "trigger": "how to reproduce", "fix": "one-line", "lesson": "what to check next time"}
```
Future sessions check this first (Phase 2.3).

---

## Output Format

```markdown
# Debug Report

> Bug: [one-line description]
> Status: FIXED / ESCALATED / NOT REPRODUCIBLE
> Root Cause: [one-line mechanism]
> Files Changed: [list]

## Evidence Summary
## Root Cause Analysis
## Fix Applied
## Regression Test
## Verification
- [ ] Regression test passes
- [ ] Full test suite passes
- [ ] Production build succeeds
- [ ] Smoke test passes
## Learnings
```

---

## Debugging Principles

- **Understand before you fix** — 80% understanding, 20% fixing.
- **One change at a time** — otherwise you don't know what fixed (or broke) it.
- **Trust evidence over intuition** — "it shouldn't behave this way" means your mental model is wrong.
- **The bug is in your code** — exhaust your own code before blaming framework/OS/compiler.
- **Intermittent = race condition, leak, or state corruption** — timestamp everything.
- **Read the actual error** — including the full stack trace, before concluding anything.
- **Rubber duck it** — explaining the problem often reveals the answer.
- **Fresh eyes** — stuck too long? Describe the problem to the user and ask for missing context.
