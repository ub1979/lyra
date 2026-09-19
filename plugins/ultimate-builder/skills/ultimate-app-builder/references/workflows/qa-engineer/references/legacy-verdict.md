## Step 3.5 — UI/UX Design Audit (Web and Desktop Apps)

Run alongside functional testing — "works but looks terrible" is a real bug.

**Health Score (0-100, weighted):**

| Category | Weight | Check |
|---|---|---|
| Visual hierarchy | 15% | Clear focal points, consistent headings, scannable flow |
| Typography | 10% | ≥14px body, consistent scale, line-height 1.4-1.6, ≤3 font families |
| Color | 10% | Consistent palette, WCAG AA contrast (4.5:1 text), meaningful color use |
| Spacing | 10% | Consistent padding/margins, alignment, no cramped layouts |
| Interaction | 15% | Clickable affordances, hover/focus/loading/disabled/error states |
| Responsive | 10% | Works at 375/768/1440px, no horizontal scroll, readable everywhere |
| Motion | 5% | Purposeful animations, no jank, respects prefers-reduced-motion |
| Content | 10% | No lorem ipsum/placeholders, proper empty states, helpful errors |
| AI slop | 10% | Blacklist below |
| Performance | 5% | No layout shift, optimized images, smooth scrolling |

Grades: 90-100 A, 80-89 B, 70-79 C, 60-69 D, <60 F.

**AI Slop Blacklist** — flag each as a MEDIUM design bug: generic purple-blue gradient hero; 3-column icon-card feature grids; everything center-aligned; generic blob/undraw illustrations; "Get Started"/"Learn More" CTAs everywhere; identical rounded-card-with-shadow blocks; three-testimonials-with-avatars rows; 200px+ section gaps; the Hero→Features→Testimonials→CTA→Footer template; no brand personality (swap the logo, could be any company).

**Dual grading in the report:** Design Grade (A-F from rubric) and AI Slop Grade (A = none, F = 5+ patterns).

**Goodwill Reservoir (UX debt).** Users start at 70/100; deduct per friction: unexpected reload -10; form clears input on error -15; no loading indicator >1s -5; confusing navigation -10; error without recovery path -20; success without confirmation -5; forced unnecessary step -5; broken back button -15; layout shift -5. Below 30 → HIGH UX bug: "Users will abandon this app due to accumulated friction." Include score + friction log in bug-report.md.

---

## Step 4 — Write bug-report.md

Write ALL bugs to `<working_directory>/bug-report.md`. Full template: `references/bug-report-template.md` (bug entry format, per-type test execution logs, per-story results, sign-off checklist).

Rules:
- Severity per bug: **CRITICAL** (system broken, data loss, security breach), **HIGH** (major feature broken), **MEDIUM** (works but not as specified), **LOW** (cosmetic).
- Evidence per bug AND per PASS: which tool, exact command/action, actual output. Example entry:

```markdown
### BUG-003 — HIGH: Login accepts expired token
- Tool: curl | Command: `curl -H "Authorization: Bearer <expired>" localhost:3000/api/me`
- Expected: 401 | Actual: `200 {"user":...}` (output pasted)
- Repro: steps 1-3 above | Screenshot: .sdlc/qa-screenshots/bug-003.png
```

- Test execution log shows EVERY test run, not just failures.
- "Untested Areas" section for anything untestable, each with a risk level.
- Never sign off with CRITICAL or HIGH bugs open.
- UI projects: include Design Grade, AI Slop Grade, Goodwill Reservoir score, and screenshot references for every visual bug.

**Requirements Gaps Found During QA.** When a requirement is untestable ("should be fast"), contradictory, missing (unspecified real scenario), or ambiguous (you had to guess), log it in a dedicated section:

```markdown
| Requirement | Issue Type | Description | Suggestion |
|---|---|---|---|
| FR-012 | Untestable | "Should be fast" — no target | Define: p95 < 200ms |
```

Feed gaps back to the requirements engineer/product owner; any gap that blocked testing is HIGH priority.

---

## Step 5 — Fix Loop (QA-Driven Fixes)

In a bounded verification-only job, save reproducible findings for a separate
developer repair and then a targeted QA retest; do not consume the entire QA
budget implementing features. If the assignment explicitly includes a small
repair, these rules apply:

1. Only fix bugs you found with evidence — never fix what you didn't test.
2. One fix at a time: locate source → minimal fix → commit → re-test.
3. Classify each: **VERIFIED** (re-test passes with evidence) / **BEST-EFFORT** (applied, not fully verifiable) / **REVERTED** (broke something else).
4. Auto-generate a regression test per fix — a test that would have caught the bug — and add it to the suite.
5. Self-regulate: after 5 fixes, pause — symptoms or root cause? Hard stop at 50 — that codebase needs a rewrite, not patches. Log the count in bug-report.md.

Per-fix record: `FIX-NNN: bug ref, root cause (file:line), change made, commit hash, re-test result, regression test location, re-test evidence`.

---

## Step 6 — Retest Cycle (After Developer Fixes)

**Match the original tool.** Re-run the EXACT tools and commands that found each bug — Playwright bug → same Playwright test; curl bug → same curl command and payload; DB bug → same query; CLI bug → same command; MCP bug → same MCP call. Re-running unit tests alone verifies nothing.

Sequence:
1. Read the updated bug-report.md / fix summary.
2. Per fixed bug: re-run exact repro steps with the same tool; paste new output as evidence.
3. Run the FULL automated suite, not just fixed areas.
4. Re-run Playwright tests for any UI-involved bug; re-query the DB for any data-mutation bug.
5. **Re-attempt every BLOCKED area from the previous run.** BLOCKED is not permission to skip forever — reinstall the tool, re-request access. A blocked area stays in the report, re-attempted every cycle, until actually tested or the user explicitly accepts the risk in writing.
6. Regression sweep of features related to each fix; add any new bugs found.
7. Update sign-off with retest evidence. Repeat until APPROVED.

---

## Step 7 — Final Verdict

- **APPROVED**: "QA passed. All tests executed with evidence. Ready for deployment — run the `devops-engineer` skill."
- **REJECTED**: "QA found X issues. Feed `bug-report.md` to the `sw-developer` skill to fix, then retest."
- **BLOCKED**: "QA could not complete — [missing tool/access/environment]. Resolve blockers and rerun QA."

APPROVED additionally requires ALL of:
- For `QA-MVP-001`, apply the personal smoke assignment's explicit verdict
  requirements instead of the production-only gates below. Report every
  inapplicable or untested area honestly and block on a failed approved core
  criterion.
- Production Readiness Pass executed (production build ran, config audited, dependency failure drill done).
- Exploratory sessions run for every major feature area.
- No area still BLOCKED — each previously blocked area executed, or its risk explicitly accepted by the user in writing.
- No verdict resting solely on mocked tests.
- UI projects: Design Grade ≥ B, AI Slop Grade ≥ B, Goodwill Reservoir > 30.
- Fix loop complete with every fix classified (VERIFIED/BEST-EFFORT/REVERTED).

Never approve with untested areas unless the user explicitly accepted the documented risk.

---

## Testing Principles — Non-Negotiables

1. **Detect the project type, then test accordingly** — and within that strategy, be exhaustive.
2. **Tool output is the only evidence.** "The code looks correct" is not a result. Never say "verified" without pasting output; if you're rationalizing why you didn't run something, stop and run it.
3. **Full campaign: UI → interact with every element** (Playwright for web/Electron; BLOCKED for unautomatable native). **API → call every endpoint** (valid, invalid, no auth, wrong auth). **DB → verify every mutation by querying.** **CLI → run every command** (valid/invalid/no/edge args, exit codes, stdout/stderr). **Library → call every export**, imported into a fresh project. For `QA-MVP-001`, exercise each approved core user journey and its relevant failures as the personal assignment defines.
4. **Every user story tested against its acceptance criteria** — Given/When/Then, executed literally.
5. **Never sign off with CRITICAL or HIGH bugs open.** REJECTED until fixed and retested.
6. **Install what you need without waiting**; ask only for credentials/system access.
7. **Absence of evidence is not evidence of absence** — untestable areas are BLOCKED with a risk level, never silently skipped, and **BLOCKED never becomes forgotten**: re-attempt every cycle until tested or risk-accepted in writing.
8. **Web apps: test like a human** — real browser at the frontend URL, console checked. curl against the backend tests a different code path (CORS, proxy, fetch client, DOM) and is never a substitute.
9. **External integration claims require real evidence** — run the real tool/API/query when authorized; otherwise report the validation gap explicitly. Mocked coverage alone never proves the external service works.
10. **Test the actual user action end-to-end** — the path the user takes, not a parallel one.
11. **The production build is the system under test** — built, started with production-like config, smoke-tested before sign-off. "Works in dev" is not a verdict.
12. **Hunt beyond the requirements** — exploratory sessions are mandatory; "no requirement covered it" never excuses a shipped bug.
13. **Fix what you can, track what you can't** — every fix re-tested with evidence and committed separately; at 50 fixes, stop and escalate.
14. **You are the gate.** If it's not ready, it doesn't ship. Don't be nice — be thorough.
