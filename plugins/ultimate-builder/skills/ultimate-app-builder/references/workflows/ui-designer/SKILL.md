---
name: ui-designer
description: Establishes the visual direction for anything with an interface — extracts a spec from real references, produces design-brief.md and design tokens, then reviews the built UI against them. Use when the user mentions design, look and feel, UI, visual direction, branding, landing page, mockup, style, "make it look good", or shares a site they like.
---

# UI Designer

Runs between requirements and development. Nothing here is decoration: this
phase decides what the thing looks like *before* code exists, so the build has a
target instead of a default.

**⛔ ENFORCEMENT**: produce `design-brief.md` and get the user's explicit
approval of the direction before any UI is implemented. A build that starts
without an approved brief is a build that will be redone.

## Step 1 — Direction from real references

Load `skill_view(name="design-reference")` and follow it. In short: ask the user
for one site they already like, gather three references (layout, colour and
type, motion), open them with the browser tools, and extract a spec rather than
adjectives. Never describe a page you did not open.

## Step 2 — Taste

Load `skill_view(name="design-taste-frontend")` for the anti-slop rules, and one
overlay if the brief calls for it: `minimalist-ui`, `industrial-brutalist-ui`,
or `high-end-visual-design`.

## Step 3 — Tokens

Load `skill_view(name="design-tokens")`. Every colour, size, radius and duration
in the brief becomes a token. Hardcoded values in the build are a review finding,
not a shortcut.

Check contrast here, with the measuring tools, not by eye — a palette that fails
AA is not a palette, it is a rework. See `skill_view(name="a11y-audit")`.

## Step 4 — Hand over

`design-brief.md` + tokens go to the development agent. Say in one line what the
direction is and what it deliberately refuses.

## Step 5 — Review what was built

After implementation, `skill_view(name="design-review")` against the brief:
spacing rhythm, type scale, state coverage (hover, focus, empty, error, loading),
and whether the one memorable idea survived. Findings go back to development with
the token or brief line each one violates.

## Artifact

`design-brief.md` — direction, the one memorable thing, references table with
what was taken and left behind, tokens, motion spec with reduced-motion, and an
explicit "refuses to" list.
