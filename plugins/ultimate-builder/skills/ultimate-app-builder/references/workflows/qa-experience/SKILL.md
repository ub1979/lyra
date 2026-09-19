---
name: qa-experience
description: Audit usability, layout and accessibility evidence.
---

# Experience QA Skill

Verify that the approved application is understandable and usable, including its
layout and accessibility. Reuse Functional QA's setup and evidence; this skill
does not repeat the entire functional suite or redesign the approved interface.

## When to Use

After Functional QA for Reusable and Production projects, or when the user opts
into deeper Experience QA for a Personal project. Execute only the assigned
scope. For non-visual products, assess the actual CLI/API/library user experience.

## Prerequisites

Read `ultimate-builder:qa-evidence` completely, normally already loaded by the
queue, and `.sdlc/qa-functional.md`. Compare its revision and dirty files to the
current application. Use the existing browser setup, native browser tools and
`terminal`; no MCP server is required. Test requirements define supported
platforms, viewports and accessibility targets.

## How to Run

Reuse the parent's startup and browser commands with isolated data. Inspect
screenshots with available vision/browser tools and interact with the actual
interface. Read only relevant design and accessibility references. If formal
accessibility auditing is required, load the existing `a11y-audit` skill and
follow its applicable checks, reporting unavailable checks honestly.

## Quick Reference

| Area | Evidence |
|---|---|
| Layout | Supported viewport screenshots and measured overflow |
| Interaction | Real keyboard/pointer journeys and focus behaviour |
| Readability | Rendered contrast measurements, labels and actual copy |
| Assistive technology | Named tool/reader and actions actually executed |
| Non-UI experience | Real CLI help/errors, API errors or library examples |

## Procedure

1. Read approved design and experience criteria. Reuse current Functional
   evidence. Rerun affected checks only when source or inputs changed, or the
   evidence is missing. Do not reinstall a working test environment.
   Apply the shared QA Evidence execution preflight to the remaining experience
   journeys; reuse Functional's browser script/setup without repeating its suite.
2. For UI apps, check representative pages at the supported narrow and desktop
   sizes. Inspect clipped content, hierarchy, typography, spacing, alignment and
   essential controls. Record visual problems against the approved design;
   stylistic preferences alone are not functional failures.
3. Test relevant loading, empty, error, success, disabled and focus states. Check
   keyboard navigation, focus return after dialogs and recoverable errors. Use
   one short exploratory journey for each distinct major experience, avoiding
   replay of already verified arithmetic or other logic permutations.
4. Measure relevant rendered text/control contrast and verify accessible names,
   roles, headings and labels. Test reduced motion and zoom when applicable.
   Run the required accessibility tools for the approved target. Actual screen-
   reader announcements require an actual named reader test; DOM live-region
   attributes alone support only an attribute-level claim.
5. Check that errors explain recovery, empty states explain the next action, and
   copy matches the app's behaviour. Check observed responsiveness against stated
   requirements. Formal load tests and security audits remain with the selected
   specialist/Functional readiness work; reuse valid evidence.
6. For non-UI products, check documented help/examples, actionable errors, output
   readability and discoverability through the real entry point. Mark visual
   checks inapplicable with reasons; never create a UI just to test one.
7. Save `.sdlc/qa-experience.md` with checks, evidence, failures and limitations.
   Send concrete product defects to a bounded Development repair. Recheck the
   affected experience after repair. Do not modify design merely to improve an
   arbitrary aesthetic score.

## Pitfalls

- An automated accessibility scan is not full conformance or a screen-reader
  test. Identify its coverage and limitations explicitly.
- Do not hide a Functional failure with a good visual verdict, or erase its
  report when producing the combined result.
- Do not invent a web/browser requirement for a CLI or API project.
- A new report or test script alone does not invalidate unchanged product
  evidence; actual changed inputs determine which checks need to run again.

## Verification

As the final selected job, inspect both scoped reports and current evidence.
Write one `bug-report.md` naming Functional and Experience coverage separately.
Open serious defects or missing required checks block overall approval. State
which accessibility tools, browsers and environments were tested, and which
were not. Only then may the existing Quality assurance phase become verified.
Production sign-off additionally requires its approved operational/security/
performance criteria; experience checks alone cannot establish readiness.
