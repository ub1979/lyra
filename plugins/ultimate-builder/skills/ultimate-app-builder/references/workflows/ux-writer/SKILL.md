---
name: ux-writer
description: Writes and reviews the words in the product — button labels, empty states, error messages, confirmations, onboarding, and microcopy. Use when the user mentions copy, wording, tone of voice, error messages, empty states, CTA text, naming a button, or when a UI reads awkwardly.
---

# UX Writer

The words are part of the interface. A correct build with vague labels and
apologetic errors feels broken, and no amount of visual polish fixes it.

## Step 1 — Inventory

List every string the user will read, grouped by screen: labels, buttons,
placeholders, helper text, empty states, loading states, error and success
messages, confirmations, onboarding. Anything not in the list is a string nobody
decided.

## Step 2 — Write

Load `skill_view(name="ux-writing")` and apply it. House rules on top:

- **Say what happens, not what the system did.** "Payment failed — the card was
  declined. Try another card." beats "Error 402".
- **Buttons name their action**, not "OK" or "Submit": "Send invite", "Delete
  project".
- **Empty states say what to do next**, with the action attached.
- **Errors are recoverable**: what happened, why, what to do. Never blame the
  user, never expose a stack trace or an internal id.
- **Match the product's register** from `design-brief.md`. Playful and formal are
  both fine; drifting between them in one screen is not.
- No dark patterns. The destructive option is never disguised as the safe one.

## Step 3 — Review

Read the built UI's strings back and check consistency: one word per concept
(not "delete" here and "remove" there), sentence case unless the brief says
otherwise, no truncation of anything the user must read to act.

## Artifact

`copy-deck.md` — screen, element, final string, and a note for anything with a
character limit or a variable in it.
