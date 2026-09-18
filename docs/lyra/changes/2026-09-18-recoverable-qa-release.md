# Recoverable QA beta release — 2026-09-18

User authorized pushing the locally verified fixes and trying a new application
through visible Studio. Release scope is the three fixes documented in
`2026-09-17-bounded-qa-and-budget-handoff.md`, not a claim of complete autonomous
application reliability. Keep that report's incomplete real-model acceptance
and performance limitations explicit.

Acceptance: synchronized beta version/notes/assets, clean-candidate scoped
Python and browser restart/reload tests, web checks, no unrelated files staged,
fast-forward-only push to the existing origin. Preserve existing projects and
jobs; no running dashboard restart without agreement. No schema migration.

Rollback: revert scoped commits; existing task summaries remain readable.
Verification and delivery results will be appended before release handoff.
