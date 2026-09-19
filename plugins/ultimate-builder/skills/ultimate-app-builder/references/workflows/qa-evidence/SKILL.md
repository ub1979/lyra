---
name: qa-evidence
description: Record trustworthy evidence for a selected QA scope.
---

# QA Evidence Skill

This is the shared evidence contract for Functional and Experience QA workers.
It governs how to test and report; the assigned skill and work item define what
to test. It does not add another QA job or expand the approved requirements.

## When to Use

Load together with `ultimate-builder:qa-functional` or
`ultimate-builder:qa-experience`. The durable queue supplies both skills through
Hermes' existing per-task skill loading. Read each selected skill completely.

## Prerequisites

The assigned workspace, current work item, approved requirements and revision.
Use native `read_file`, `search_files`, `terminal` and available browser tools.
No MCP server is required; use an already configured one only when appropriate.
Browser checks require a real browser runtime or the native browser tools.

### Mandatory browser-automation rule

Project QA must never create, invoke or repair raw Chrome DevTools Protocol
(CDP) automation. This prohibition includes direct DevTools WebSocket clients,
`chrome-remote-interface`, hand-written `Runtime.evaluate` / `Input.dispatch*`
drivers and project-local CDP harnesses. Hermes may use CDP internally behind
its supported browser tools; QA workers must not bypass those tools or build on
that internal protocol.

Use, in order: the project's working Playwright command, an already available
Playwright runner/MCP, or Hermes' native browser tools. If none can perform a
required check, record that check as **BLOCKED** with the missing capability.
Never replace the missing capability with a custom browser driver.

## How to Run

Work only in the assigned project. Read the saved task and prior-attempt handoff,
repository instructions, requirements and relevant change record. Check the
Project Brain for the existing test command and setup. Inspect Git status and
revision before relying on earlier evidence. Changed inputs invalidate affected
checks even if a previous report says PASS.

Before the first interactive browser check, record a short execution plan in
the assigned evidence file: criterion groups, existing test command, browser
method, missing capabilities and checks owned by a later selected QA scope.
Choose the method now, not after exhausting the call budget:

- Reuse a working project browser command first. Otherwise use `terminal` once
  to check available Playwright automation and its browser. If available, save
  one small Playwright smoke test and run it directly. Do not install a
  framework, write a raw-CDP fallback or launch a second QA worker.
- Use actual sequential click/fill/key actions with bounded assertions, console
  capture and cleanup. Reset state between independent cases; preserve state
  intentionally within a journey. Expected answers come from approved
  behaviour, not from calling the same app function being tested.
- If no suitable runner exists, use native browser tools for the mapped
  journeys, gathering related read-only assertions after each journey. Do not
  spend a model round trip inspecting every keystroke or replay all unit-tested
  numeric permutations. Inspect current labels/references before acting; after
  navigation or lost browser state reacquire them instead of retrying stale IDs.
- On failure, isolate the smallest failing journey. Check input sequence and
  test-state reset before blaming the app or browser. Record harness failures
  separately, rerun the affected checks, and stop repeated identical recovery
  attempts when they produce no new evidence: save the exact blocker/handoff.
- A broken or unavailable Playwright/browser-tool path is a harness blocker,
  not permission to switch to CDP. Preserve the failure and stop cleanly.

This execution method applies to both QA scopes and every profile. It does not
reduce approved coverage or change which worker may complete the QA phase.
Keep passing evidence reusable; a retry continues missing checks rather than
replaying the whole campaign. Browser assertion counts are not journey counts.

## Quick Reference

| Evidence | Permitted claim |
|---|---|
| Passing automated command | Those automated checks passed |
| Browser actions and assertions | Those real UI journeys passed |
| Mock provider run | Application behaviour with that fixture passed |
| DOM labels, roles and live-region attributes | Those attributes were verified |
| Actual screen-reader interaction | The named reader's tested behaviour passed |
| Unavailable tool or unexecuted check | Untested / BLOCKED, with reason |

## Procedure

1. Map the approved criteria in this job to a compact set of checks. Several
   criteria can share one real journey. Do not duplicate passing flows to inflate
   test counts. Do not invent security, deployment or volume requirements for a
   local tool. A stated requirement still applies to a Personal project.
2. Reuse the existing test command and browser setup. Fill only demonstrated
   gaps. Use temporary data/config, an isolated browser context, free ports,
   readiness checks and cleanup of owned processes. Never alter the user's live
   data, installed applications or macOS permissions to obtain screenshots.
3. Run checks with tools. Use actual browser navigation, fill, click and key
   actions; DOM inspection can support assertions, not replace user interaction.
   Existing automation can batch a journey into one command. Write only a small
   missing Playwright smoke test; do not construct a new framework, use raw CDP
   or duplicate the logic suite in the browser. If setup is unavailable, name
   the exact blocker.
4. Preserve the test command's exit status. Run it directly. If capturing output,
   the shell must return the saved test exit code; printing `EXIT=1` is not enough.
   A later successful reporting command does not erase the failed test. Do not
   accept a pipeline's final status as proof of the test result. Failed assertions,
   exceptions, missing expected results and incomplete runs cannot become PASS.
   Run version/diagnostic/report commands separately from the test. Preserve
   existing machine evidence labelled unverified; prose cannot promote it to
   PASS. Rerun that check directly to obtain a trustworthy result.
5. Diagnose a failed check before attributing it to the app. Confirm expected
   values against requirements and real behaviour. Repair a faulty test, rerun
   it, and retain the earlier failure as a harness error. App defects go to a
   bounded Development repair, followed by the affected QA checks.
6. Save commands, raw outputs, exit codes, revision/dirty files, screenshots where
   useful, and untested areas under the assigned task's evidence path. Keep one
   concise report for this scope; the Brain and ledger link to it. Do not paste
   entire repeated reports into every project document.
7. Stop when this job's criteria have evidence or a concrete blocker. Save an
   exact handoff before exhausting the existing call budget. Reuse Hermes task
   comments and dependencies; do not launch nested QA copies.

## Pitfalls

- A completed model turn, a shell exit of zero, or a developer's report alone
  does not prove that the requested checks passed.
- DOM accessibility checks do not prove screen-reader announcements, and a few
  automated checks do not establish full WCAG conformance.
- No Experience assignment means Experience QA was not performed. Do not report
  it as passed. A Personal functional approval is not production sign-off.
- A missing required check blocks approval. An inapplicable check needs a reason;
  an applicable untested requirement needs a blocker or explicit user acceptance.
- Raw CDP evidence produced by a QA worker is invalid project evidence. Rerun
  the affected check through Playwright or supported browser tools, or mark it
  BLOCKED.

## Verification

Report PASS, FAIL or BLOCKED for each in-scope criterion and link its evidence.
Open serious defects or required untested behaviour prevent an approved verdict.
QA must not create repair tasks, schedule workers, rewire dependencies or repair
application source (including through `terminal`). This role boundary takes
precedence over generic follow-up-task advice. QA may write or repair tests and
evidence. The coordinator owns Development routing in the approved scope.

For a new defect, save a `kanban_comment` naming failed criteria, revision,
reproduction, evidence, repair scope and exact affected retest commands. Then
call `kanban_block(kind="needs_input", reason="Coordinator: route the saved repair and retest")`.
A QA-only request ends here until repair is authorized. Do not complete a failed
QA job to unlock a child. Use `kind="dependency"` only when the coordinator has
already linked an unfinished repair as a **parent prerequisite of this QA task**.
A child of QA waits for QA, so it cannot unblock QA. A rejected dependency block
must become a saved coordinator handoff with `needs_input`, never inline repair.
After a properly routed repair, verify changed revision and rerun affected or
invalid checks, reusing still-valid evidence. Do not use
`kanban_complete` merely to let the next job start despite failed checks.
Only the final selected QA work item may assemble `bug-report.md` and mark the
Quality assurance phase verified. For two jobs, the final worker must inspect
Functional evidence against the current revision before combining verdicts.
Earlier jobs save their scoped report and leave the overall phase in progress.
The final report names selected scopes, actual coverage and remaining risks;
it never claims universal reliability or deployment readiness from a smoke pass.

For newly queued focused QA, the final job also carries a pinned coverage
contract and a small JSON report template. Fill that exact report from the
actual results. A Personal profile does not waive an explicit requirement: if
body-text contrast is required, measure it or report BLOCKED, even when deeper
Experience QA was not selected. “Not selected” is not a PASS for that criterion.
Only the final job assembles this matrix; a non-final Functional worker can
finish its assigned passing checks and hand remaining Experience checks to the
dependent job. Missing coverage makes project acceptance need review, not an
endless worker retry. Readable evidence and completed jobs are not independent
proof of correctness or user approval.
If the pinned mapping is empty, stop at preflight and report the mapping problem
before a browser campaign. Do not replace the contract with a self-approved
resolution note. Required checks outside the default scope remain required;
perform them here when this is the final selected job, or explicitly hand them
to the selected dependent scope. An unselected scope is not a user waiver.
