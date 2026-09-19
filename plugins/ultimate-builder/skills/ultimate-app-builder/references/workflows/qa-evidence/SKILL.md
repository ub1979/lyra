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

## How to Run

Work only in the assigned project. Read the saved task and prior-attempt handoff,
repository instructions, requirements and relevant change record. Check the
Project Brain for the existing test command and setup. Inspect Git status and
revision before relying on earlier evidence. Changed inputs invalidate affected
checks even if a previous report says PASS.

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
   missing smoke test; do not construct a new framework or duplicate the logic
   suite in the browser. If setup is unavailable, name the exact blocker.
4. Preserve the test command's exit status. Run it directly. If capturing output,
   the shell must return the saved test exit code; printing `EXIT=1` is not enough.
   A later successful reporting command does not erase the failed test. Do not
   accept a pipeline's final status as proof of the test result. Failed assertions,
   exceptions, missing expected results and incomplete runs cannot become PASS.
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

## Verification

Report PASS, FAIL or BLOCKED for each in-scope criterion and link its evidence.
Open serious defects or required untested behaviour prevent an approved verdict.
Use `kanban_block` with the supported `dependency` or `needs_input` reason kind
and an exact handoff when the assignment cannot pass; do not use
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
