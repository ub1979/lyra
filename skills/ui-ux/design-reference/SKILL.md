---
name: design-reference
description: Turn real websites and motion examples into a concrete design direction — extract layout, type scale, colour, and motion from gallery references (Land-book, Motionsite, a URL the user supplies) and write design-brief.md that the build phase can follow. Use when a project needs a look and feel, the user shares a site they like, asks for "something like X", wants a landing page or marketing site, or a UI needs an opinionated visual direction rather than defaults.
---

# Design Reference

Taste is not a vibe you assert, it is a spec you extract. This skill turns
"make it look good" into decisions someone can build from, sourced from real
pages instead of from the model's defaults.

Output: `design-brief.md` in the project. `frontend-dev`, `taste-skill`, and the
implementation phase all read it.

## Step 1 — Find references

Ask for one thing first: **a site the user already likes**. One real reference
beats ten generated adjectives. If they have none, browse a gallery.

**Land-book** (`land-book.com`) — curated landing pages, filterable by colour,
typography, style, industry, type and platform, plus section-level galleries
(hero, pricing, features, about, careers). Best for layout and section rhythm.

**Motionsite** (`motionsite.ai`) — animated templates, sections and backgrounds
by industry, React-oriented. Best for motion direction. It is a **paid** library:
never scrape it or reproduce its prompts. If the user has access, ask them to
paste the template or prompt they own; otherwise use it only to name the effect
they want ("hero with a slow parallax gradient") and build it yourself.

Pick **three** references, not one: one for layout, one for colour and type, one
for motion. A single reference produces a clone; three produce a direction.

## Step 2 — Open them properly

Gallery sites block plain HTTP fetchers — Land-book returns 403 to a bare
request. Use the browser tools (`browser_navigate` + `browser_snapshot`), and
fall back to `web_extract` only for pages that allow it.

If neither tool is available, say so in chat, name the missing capability, and
offer the exact recovery (`/tools enable web browser`). **Never describe a page
you did not open.** An invented reference is worse than no reference: it sends
the whole build in a direction nobody chose.

## Step 3 — Extract the spec

For each reference, record what is actually on the page — measured or read off
it, not guessed:

**Structure** — section order and what each one does (hero → proof → feature →
objection → CTA). Number of sections. Where the page breathes and where it
crowds. Grid: how many columns, how wide the container, how much gutter.

**Type** — the pairing (display / body), the scale ratio between steps, the
heaviest weight in use, line length in characters, line height on body copy.
Name real fonts; if you cannot identify one, describe its class (grotesk,
transitional serif, mono) rather than inventing a name.

**Colour** — background, foreground, one accent, and how far the accent is
actually used (a 5% accent reads very differently from a 40% one). Note whether
depth comes from shadow, border, or nothing at all.

**Motion** — what moves, what triggers it (scroll, hover, load), roughly how
long, and whether it eases in or snaps. Note what does *not* move: restraint is
the decision people forget to copy.

**The one memorable thing** — every good page has a single idea you would
describe to a friend. Write it in one sentence. If you cannot find one, the
reference is mediocre; pick a better one.

## Step 4 — Decide, do not average

Averaging three references produces mush. State the direction as choices:

- what is taken from each reference, and what is deliberately left behind;
- the one memorable idea this project will own;
- what the design refuses to do (no stock-photo hero, no four-colour gradient,
  no carousel), because a stated refusal survives implementation better than a
  stated aspiration.

Show the user the direction before any code. One short paragraph plus the
decisions, and ask whether it matches what they had in mind. Their "not quite"
is cheap here and expensive after the build.

## Step 5 — Write design-brief.md

```markdown
# Design Brief: <project>

## Direction
<one paragraph a stranger could act on>

## The one memorable thing
<single sentence>

## References
| Reference | Taken | Left behind |
|---|---|---|
| <url> | section rhythm, generous whitespace | its colour palette |

## Tokens
- Type: display <font/class>, body <font/class>, scale <ratio>, body line-height <n>
- Colour: bg <hex> · fg <hex> · accent <hex>, accent used for <what only>
- Space: base unit <n>px, section padding <n>, container <n>px
- Depth: <shadow | border | flat>
- Radius: <n>

## Motion
| Element | Trigger | Duration | Easing |
|---|---|---|---|
Reduced-motion: <what is disabled under prefers-reduced-motion>

## Refuses to
- <explicit anti-goals>
```

## Rules

- **Direction, never assets.** Take structure, rhythm, and ideas. Never copy
  images, icons, illustrations, copy, or a brand's identity. If the user asks for
  a straight copy of a specific site, say plainly that you will build to the same
  quality with their own identity instead.
- **Cite what you opened.** Every reference in the brief is a URL you actually
  loaded. No URL, no row in the table.
- **Accessibility is not a later phase.** The palette must pass contrast before
  it enters the brief — measure it, do not eyeball it (see the `a11y-audit`
  skill). A direction that fails contrast is not a direction, it is a rework.
- **Reduced motion is part of the motion spec**, decided here, not retrofitted.
