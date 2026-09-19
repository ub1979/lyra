---
name: qa-functional
description: Verify approved behaviour through real user paths.
---

# Functional QA Skill

Independently verify that the application does what the user approved. This
skill covers automated checks and real user journeys, including essential UI
usability; deeper visual and accessibility audits belong to Experience QA.

## When to Use

Every selected QA phase starts here. Personal projects receive one focused
acceptance pass. Reusable and Production projects also receive Experience QA.
The queue's assigned profile and final-item rule are authoritative.

## Prerequisites

Read the complete `ultimate-builder:qa-evidence` skill, normally already loaded
by the queue. Use the project's existing automated command and available browser
tools or installed automation runtime. No additional MCP server is required.
Read requirements, relevant change records and prior evidence, not unrelated
planning history. Existing project instructions remain applicable.

## How to Run

Use `terminal` for automated commands and browser automation; use native browser
tools if an appropriate runner is unavailable. Test the real entry point: actual
web frontend, CLI command, packaged app or public library API. Scope setup to
what the application actually has; a static calculator needs no backend server.

## Quick Reference

| Profile | Required depth |
|---|---|
| Personal | Approved core behaviours and relevant failure paths |
| Reusable | All approved behaviours, boundaries and actual integrations |
| Production | Reusable coverage plus required operational/readiness checks |

Always include the approved requirements, even when one calls for a check that
is normally optional at this profile. Do not change profile or invent features.

## Procedure

1. Identify the app type and map the assigned acceptance criteria to checks.
   Reuse Development's test command and setup, but execute independently. A
   missing change record for an existing-code change is a process finding, not
   permission to start a new planning exercise.
2. Run the automated suite. Review failures and any critical coverage gaps.
   For a dependency-free Node project, the built-in `node --test` runner is
   sufficient. Do not install another framework merely because no config exists.
3. Exercise each approved core journey through its real entry point. Cover the
   successful path, relevant invalid/empty input, failure messages and recovery.
   Verify saved data after reload/restart, or reset behaviour for a stateless app.
   For UI apps check console errors, actual keyboard operation, readable labels,
   visible focus and a narrow screen without clipped essential controls.
   These checks remain required even when Experience QA is not selected.
4. Add applicable boundaries using existing automation. Keep numeric permutations
   in the logic suite once the real UI wiring is exercised. API projects cover
   relevant method/schema/auth failures; CLI projects cover arguments, stdout,
   stderr and exit codes; libraries exercise exports from a real consumer.
   Check stored values through the application's storage where applicable.
5. For Reusable projects, test approved integrations, cancellation, repeated
   actions and recovery appropriate to the app. Distinguish deterministic mock
   evidence from authorized real-provider smoke results. Missing credentials
   mean that external-provider claim remains unverified.
6. For Production projects, run the actual release build and documented fresh
   setup. Check required configuration failures, restart/data safety, dependency
   failures and concurrency in an isolated environment. Verify security,
   performance and recovery criteria from the approved requirements, reusing
   current evidence from `security-auditor` and `benchmark` workers where valid.
   If a required deep audit needs another specialist, record the bounded
   dependency for the coordinator. Never silently waive it or create a swarm.
7. Save `.sdlc/qa-functional.md` with a compact criterion → check → evidence →
   result table, tested revision, reusable setup commands and remaining risks.
   Preserve raw evidence separately. Route product defects to Development;
   do not spend this job building new features or redesigning the application.

## Pitfalls

- Curl or passing unit tests alone cannot verify the browser UI.
- Do not reimplement all unit tests in a large new browser script. Reuse small,
  sequential real journeys and existing automation.
- Personal scope excludes a full design grade, exhaustive visual campaign,
  production drills and load tests unless the approved requirements need them.
- Unknown or skipped results are not zero failures. Name what was not tested.

## Verification

Every approved criterion assigned to this job needs real evidence or a blocker.
For Functional-only QA, write `bug-report.md` with the scoped verdict and state
that deeper Experience QA was not selected. For a two-job plan, leave overall QA
in progress; Experience QA receives the setup and functional report via the
existing task dependency and verifies them before assembling the final verdict.
