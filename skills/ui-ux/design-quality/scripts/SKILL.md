---
name: design-render-checks
description: Run shared rendered-interface checks.
---

# Design Render Checks Skill

This package owns the existing browser and contrast helpers used by sibling
design skills. Their stable paths are retained for compatibility.

## When to Use

Measure actual contrast and interactive states during interface QA.

## Prerequisites

Python 3 for contrast checks. Node and Playwright with the required browser
for render checks. Do not claim a missing browser was tested.

## How to Run

Use `terminal` to execute a helper beside this skill against the approved app.

## Quick Reference

- `contrast.py`: check a foreground/background color pair.
- `measure_render.mjs`: measure text contrast in the rendered page.
- `verify_states.mjs`: inspect interactive visual states.
- `axe_audit.mjs`: run the accessibility audit.
- `lint_taste.py`: inspect design rules.

## Procedure

Read the selected helper's usage, run it against the actual page, inspect its
exit status and findings, repair genuine defects, and rerun affected checks.

## Pitfalls

Do not confuse a harness error with an application defect. Do not mask exit
codes with output pipelines. Keep this phase within the chosen project scope.

## Verification

Record the command, result and untested browsers. These executable resources
remain at their legacy paths so sibling skills continue to resolve them.
