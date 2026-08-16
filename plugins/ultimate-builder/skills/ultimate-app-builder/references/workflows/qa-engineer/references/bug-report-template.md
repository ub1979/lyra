---
name: bug-report-template
description: Full bug-report.md template for the QA engineer — bug entry format, per-type test execution logs, per-story results, and the sign-off checklist.
---

# `bug-report.md` Template

Copy this structure into `<working_directory>/bug-report.md`. Every PASS needs
evidence too — a verdict without a pasted command and its actual output is not a
QA result.

---

## 1. Header

```markdown
# QA Report — <project name>

- Tested build   : <commit sha / tag>
- Scope          : Full pipeline | Codebase only   (QA is always full-workspace)
- Changed        : <what triggered this run>
- Environment    : <OS, runtime versions, production build yes/no>
- Started        : <ISO timestamp>
- Completed      : <ISO timestamp>

## Verdict

**PASS | CHANGES REQUIRED | BLOCKED**

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH     | 0 |
| MEDIUM   | 0 |
| LOW      | 0 |
```

`CHANGES REQUIRED` whenever any CRITICAL or HIGH is open. "Approved with
recommendations" is not a verdict — an open MAJOR+ finding routes back to the
fix loop.

---

## 2. Bug entry format

One block per bug. IDs are stable across reruns: never renumber a fixed bug.

```markdown
### BUG-003 — HIGH: Login accepts expired token
- Tool     : curl
- Command  : `curl -H "Authorization: Bearer <expired>" localhost:3000/api/me`
- Expected : 401 Unauthorized
- Actual   : `200 {"user":{"id":7,"email":"a@b.c"}}`
- Repro    : 1. Mint a token with exp in the past  2. Call /api/me  3. Observe 200
- Impact   : Any leaked token remains valid forever; session revocation is a no-op.
- Evidence : evidence/bug-003-curl.txt
- State    : OPEN | FIXED (verified <ISO>, same command) | ACCEPTED (user, <ISO>)
```

Severity:

| Severity | Meaning |
|---|---|
| **CRITICAL** | System broken, data loss, or security breach |
| **HIGH** | Major feature broken |
| **MEDIUM** | Works, but not as specified |
| **LOW** | Cosmetic |

A bug leaves this file in exactly one terminal state: verified fixed by the same
tool and reproduction, or explicitly user-accepted with the acceptance recorded
inline. Nothing silently disappears.

---

## 3. Per-type test execution logs

Record how the system was started and that it actually came up, using the
start/success pair for its project type.

```markdown
## Execution log — Web app (fullstack)

- Start backend  : `npm run dev:api`      → listening on :3000
- Start frontend : `npm run dev`          → listening on :5173
- Health through the proxy:
  `curl http://localhost:5173/api/health` → `200 {"status":"ok"}`
- Production build: `npm run build`       → exit 0, 0 warnings
```

Include one block per applicable type — API service, CLI tool, desktop, mobile,
library, static site, multi-service. If a tool was unavailable and the fallback
was used, say which. If neither was available, the row is **BLOCKED**, not PASS.

```markdown
## Tool availability

| Need | Tool used | Fallback? | Result |
|---|---|---|---|
| Browser UI testing | Playwright MCP | no | OK |
| DB verification | mongosh via Bash | yes (MCP absent) | OK |
| Email verification | — | — | BLOCKED — CRITICAL |
```

---

## 4. Per-story results

One row per user story or acceptance criterion from `requirements.md`. Evidence
is mandatory on PASS as well as FAIL.

```markdown
## Story results

| Story | Criterion | Result | Evidence |
|---|---|---|---|
| S-001 | User signs up with email | PASS | evidence/s001-signup.png |
| S-002 | Expired token is rejected | FAIL → BUG-003 | evidence/bug-003-curl.txt |
| S-004 | Export to CSV | BLOCKED | no test data available |
```

---

## 5. Design and UX grading (UI projects)

```markdown
## Grades

- Design Grade   : B  (rubric score 82/100)
- AI Slop Grade  : A  (0 blacklist patterns)
- Goodwill score : 55/100

### Friction log
| Friction | Deduction | Where |
|---|---|---|
| No loading indicator >1s | -5 | Dashboard initial load |
| Form clears input on error | -15 | Signup |
```

Users start at 70. Below 30 is a HIGH UX bug: *"Users will abandon this app due
to accumulated friction."*

---

## 6. Sign-off checklist

Every line needs a real answer. An unchecked box blocks the verdict.

```markdown
## Sign-off

- [ ] Production build succeeds
- [ ] Application boots and its core user journey works against the running system
- [ ] Every story in requirements.md has a result row with evidence
- [ ] Every CRITICAL/HIGH is verified fixed or explicitly user-accepted
- [ ] Reruns used the original reproduction, not a substitute
- [ ] Tool gaps are recorded as BLOCKED rather than silently skipped
- [ ] Evidence files referenced here exist on disk
- [ ] .sdlc/progress.md ledger updated to match this report

QA engineer: <delegate/session id>
Date: <ISO timestamp>
```
