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

## Verification outcome — push held

- Candidate `9fdc1358a`, clean detached worktree
  `/private/tmp/lyra-release-01963`: 931 Python tests passed, one skipped, across
  29 scoped files (builder, worker lifecycle, real gateway, delegation, version).
- Web: 465 tests passed, typecheck and production build passed, lint zero errors
  and 30 warnings. Rebuilt web output is unchanged; version is API-provided.
- Initial browser attempt was blocked by a missing pinned Chromium binary.
  Installed the runner's required browser; built Ink from candidate source.
- Real Studio smoke then FAILED: echo-model input contained a collapsed paste
  label (`[[ IDRAK_INTERNAL_P.. [6 lines] .. hello from the studio smoke ]]`)
  instead of the complete first-turn setup. Assertion at
  `apps/desktop/e2e-studio/studio-smoke.spec.ts:89` caught the missing
  `IDRAK_INTERNAL_SETUP_BEGIN` marker.
- A subsequent unchanged-code run PASSED (startup, two turns, tokens, reload).
  This is intermittent; a passing retry does not explain or invalidate the
  failure. Suspected paste-state/submission timing needs a proper reproduction
  and regression test. Exact cause and introduction commit are not established.
- No push, runtime restart, camera activation or new project submission. Do not
  claim all release gates passed. The beta version commit remains local.

Next: reproduce the collapsed-paste submission race using the real Ink input
path, fix its owning boundary without a second chat transport, and repeat the
clean candidate gate. Then push the authorized beta and start the new project
through Studio, after agreeing to restart the idle runtime.
