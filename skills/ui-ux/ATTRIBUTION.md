# Attribution — UI/UX skills

Imported 2026-08-21.

## taste-skill, brutalist-skill, minimalist-skill, soft-skill

**Leonxlnx/taste-skill** (commit `c607b11`, 2026-08-21),
https://github.com/Leonxlnx/taste-skill — MIT License (`LICENSE-taste-skill-MIT.txt`).
Anti-slop design engineering: design-variance system, motion recipes, card
archetypes, colour rules, forbidden-pattern checklist. The three aesthetic
skills are single-file style overlays applied on top of it.

## design-quality/ (a11y-audit, design-review, design-tokens, ux-writing, design-component)

**plugin87/ux-ui-agent-skills** (commit `93a7fbb`, 2026-06-22),
https://github.com/plugin87/ux-ui-agent-skills — the README declares MIT; the
repo ships no LICENSE file, so that declaration is the whole of the grant.

These skills are thin routers into reference material, so their supporting
directories came with them: `accessibility/` (WCAG 2.2 checklist, ARIA
patterns), `taste/`, `tokens/`, `components/`, and `scripts/` (the contrast and
render-measurement gates). **Local modification:** the skills referenced those
paths from the upstream repo root, so every reference was rewritten one level up
(`accessibility/…` → `../accessibility/…`) to resolve inside this bundle.

The `scripts/measure_render.mjs`, `verify_states.mjs` and `axe_audit.mjs` gates
need Node and a headless browser; `contrast.py` needs only Python.

## frontend-design

**anthropics/skills** (commit `0a64e39`, 2026-08-18),
https://github.com/anthropics/skills — Apache 2.0.

## design-reference

Written for this repo. Not imported from anywhere.
