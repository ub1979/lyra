---
name: design-accessibility-reference
description: Read shared accessibility reference checks.
---

# design-accessibility-reference Skill

This is the owning package for existing shared design references.
Sibling design skills use these files at their stable relative paths.

## When to Use

Use with an accessibility audit or a component implementation.

## Prerequisites

Use the approved project scope. These references do not expand that scope.

## How to Run

Read the relevant reference with `read_file`, resolving it beside this skill.

## Quick Reference

- `wcag-checklist.md`
- `aria-patterns.md`
- `i18n-rtl.md`
- `wcag-aaa.md`
- `vision.md`
- `cognitive.md`

## Procedure

Apply only the criteria relevant to the requested work. Keep required safety
and accessibility checks; do not invent additional phases.

## Pitfalls

References are guidance, not proof that the application passes their checks.
Files remain beside this skill to preserve existing sibling-relative links.

## Verification

Verify the actual implemented behavior. Report untested criteria explicitly.
