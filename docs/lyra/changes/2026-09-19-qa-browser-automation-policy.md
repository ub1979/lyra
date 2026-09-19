# QA browser automation policy — 2026-09-19

## User problem and reproduction

During the Tiny Counter Personal-project journey, Functional QA ignored the
existing small-test guidance and built a hand-written raw-CDP harness. The
harness grew beyond 500 lines, produced false keyboard and storage failures,
and consumed long model turns while QA debugged its test driver instead of the
application. No saved requirement or QA instruction requested CDP; the model
selected it independently.

## In scope / explicitly deferred

This change makes raw CDP a prohibited QA implementation mechanism and directs
workers to existing Playwright or supported Hermes browser tools. It does not
remove Hermes' internal CDP-backed browser implementation, change browser tool
schemas, repair the generated Tiny Counter project, or declare the interrupted
journey successful.

## Acceptance criteria

- Focused QA instructions explicitly forbid creating, invoking or repairing raw
  CDP clients and project-local CDP harnesses.
- The rule distinguishes forbidden worker-authored CDP from supported Hermes
  tools that may use CDP internally.
- Playwright and supported browser tools remain the allowed paths.
- Missing browser capability produces an honest `BLOCKED` result rather than a
  custom protocol fallback.
- The fully registered and delivered skill is covered by a regression test.

## Affected modules and data

- `qa-evidence/SKILL.md`: shared Functional/Experience execution contract.
- `tests/skills/test_focused_qa_skill.py`: real plugin registration and complete
  skill-delivery regression.

There are no database, migration, provider, prompt-cache, security or user-data
changes. Existing queued/running workers retain the skill text loaded when they
started; the wasteful Tiny Counter QA run was explicitly stopped before this
change.

## Tests and observed results

`scripts/run_tests.sh tests/skills/test_focused_qa_skill.py
plugins/ultimate-builder/tests/test_focused_qa_workflow.py` passed all 21 tests.
This exercises real plugin registration, whole-skill delivery, budget retention,
profile selection, dependencies, reopening and control behavior.

## Compatibility / restart

New QA jobs receive the rule automatically from plugin skill loading. Existing
worker turns must be stopped and re-queued or restarted to load the new text.
The dashboard and gateway do not require a restart for files read per job.

## Rollback / retained recovery data

Revert the focused commit to restore the previous advisory wording. Tiny Counter
source, Git history and raw QA evidence remain preserved for diagnosis.

## Local commit / authorized push

This record ships in the focused local policy commit. No push or release is
authorized by this change. A fresh Functional-only QA pass will reuse the
existing Tiny Counter project after the commit; its result is acceptance
evidence, not part of this policy unit test.
