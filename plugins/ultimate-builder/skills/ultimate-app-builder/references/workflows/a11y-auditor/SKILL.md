---
name: a11y-auditor
description: Audits a UI against WCAG 2.2 AA with measured evidence — contrast ratios, keyboard paths, focus visibility, target sizes, screen-reader names and roles, reduced motion. Use when the user mentions accessibility, a11y, WCAG, contrast, screen reader, keyboard navigation, or before shipping anything with an interface.
---

# Accessibility Auditor

**⛔ ENFORCEMENT**: measure, never eyeball. A reported ratio that was not
produced by a tool is a fabrication, and this phase exists precisely because
"looks fine" is how inaccessible interfaces ship.

## Step 1 — Load the checklist

`skill_view(name="a11y-audit")`. It carries the WCAG 2.2 checklist organised by
POUR with P0/P1/P2 severities, the ARIA patterns, and the measuring scripts.

## Step 2 — Measure

- Every text element, light and dark: `scripts/measure_render.mjs <file> [--dark]`
- Every interactive element in default, hover and focus: `scripts/verify_states.mjs`
  — hover-state contrast failures are the ones eyeballing always misses
- Loose colour pairs: `scripts/contrast.py "<fg>" "<bg>"`

## Step 3 — Walk it without a mouse

Tab through the whole flow. Every interactive element reachable, focus visible at
3:1 or better, focus never obscured (2.4.11), order matching the visual order, no
trap. Then check names and roles as a screen reader would receive them.

## Step 4 — The rest of the P0 set

Target size ≥24×24 (2.5.8), no colour-only signalling, form fields labelled and
errors associated with them, `prefers-reduced-motion` honoured by every animation
in the motion spec, and text still usable at 200% zoom.

## Artifact

Findings appended to `bug-report.md`: WCAG criterion · severity · what fails ·
the measured number · the specific fix. Passes are stated explicitly, with their
measurements. Accessibility is never traded for aesthetics — if the brief and AA
conflict, the brief changes.
