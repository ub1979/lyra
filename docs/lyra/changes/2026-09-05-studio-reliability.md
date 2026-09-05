# Studio reliability and maintenance pass — 5 September 2026

Requested: fix the reviewed Studio reliability gaps, keep cohesive modules,
add behavioral tests, and provide a code map and change-management policy.

## Acceptance criteria

- Negative/partial phase reports never count as completed.
- Missing/unsafe evidence cannot be labelled Verified or counted as complete.
  Existing readable evidence is explicitly labelled reported, not independently verified.
- Question replies are atomic, request-fenced and safely retryable; stale replies
  cannot become a new chat turn.
- Computer alerts are opt-in, non-destructive, deduplicated and private by default.
- Moving/trashing a project preserves recovery ancestry without overwriting
  unrelated destination history.
- Project Brain exposes citation availability/fingerprints separately from Git
  freshness, with bounded reads and project-local path checks.
- Project queries use an index; CI discovers the builder regression tests.
- The documented eight older server failures are resolved without enabling the
  upstream updater or weakening the intended distribution behavior.

## Scope boundaries

This is not a multi-tenant hosting release or a wholesale rewrite of Hermes.
Telegram notification fan-out, server-owned push notifications with a closed
browser, independent execution of every claimed test result, and extraction of
all remaining large routes require separate changes. Browser alerts now cover
live questions and saved worker requests while Studio remains open.

## Compatibility and recovery

Rebuild the web and Ink applications and restart Lyra when it is safe to stop
active chats. The atomic reply protocol must not be paired with an old TUI.
Checkpoint relocation retains original refs; no recovery data is deliberately
deleted. Revert the application commit to roll back code; snapshots remain saved.

## Verification

- Combined targeted Python regression run: **1,018 passed**, across the builder,
  dashboard, database migration/query, recovery, protocol and maintenance suites.
- Web suite: **365 passed**. Real Ink/input regression subset: **24 passed**.
- Web production build, TUI production build, both typechecks, shared-package
  checks, focused lint and source whitespace checks passed. Rebuilt minified
  JavaScript retains generated template-string whitespace and is excluded from
  the source whitespace check.
- The generated file inventory passes its freshness check and is enforced in
  the Python CI preparation job.
- The eight pre-existing server-test failures are resolved. Tests now exercise
  Lyra's intentional disabled updater, actual onboarding user-agent contract,
  and a custom theme name that does not collide with a built-in theme.
- These are targeted release checks, not a run of the entire upstream Hermes
  test suite or a live multi-user deployment/security certification.
- The existing web bundle-size advisory remains; code splitting is a follow-up.

Save as a local implementation commit after final inspection. No remote push
is authorized by this change request; version bump happens with an authorized
push in accordance with the repository's version discipline.
