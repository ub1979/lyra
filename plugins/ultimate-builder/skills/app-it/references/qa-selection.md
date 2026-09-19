# Selecting QA scope

Use the existing `qa-engineer` phase in `project_run`; it preserves Studio's
phase, notifications and selected QA model/provider. The queue chooses complete
skills internally. Do not queue `qa-functional` or `qa-experience` as phase ids.

| User-selected profile | New QA work |
|---|---|
| `personal` | One Functional acceptance pass including real entry-point, errors, persistence/reset, keyboard and narrow-layout checks |
| `reusable` | Functional followed by Experience QA |
| `production` | Both, with requirements-driven readiness/security/performance/recovery coverage |
| No saved profile | Legacy four-stage campaign; ask for a profile when starting a new project |

Personal users may request deeper Experience QA. For a new QA plan pass
`qa_experience=true` along with `build_profile="personal"`. This adds coverage;
it never removes checks required by the selected profile. Do not silently opt
a Personal user into deeper QA. There is no new Studio checkbox in this change;
honour the user's request through the existing conversation and queue tool.

Once queued, a campaign retains its shape on reopen, even if a later request
omits the profile. Adding Experience to a new-style Personal campaign requires
the current pass to finish, then an explicitly requested fresh review with
`force_new=true, qa_experience=true`. Never restart an active review just to
change scope. Saved legacy campaigns keep their existing stages and cannot be
expanded in place; report that limitation instead of pretending it was applied.

Jobs share the directory and remain sequential. Functional saves
`.sdlc/qa-functional.md`; Experience reuses its setup and valid evidence and saves
`.sdlc/qa-experience.md`. Only the final selected job writes the combined
`bug-report.md` and may mark overall QA verified. Missing required evidence or
serious findings block approval. Read the remaining jobs before advancing.

When a job reports defects, route bounded Development repair and the affected
QA retest within the approved scope. A QA-only request authorizes reporting;
ask before expanding it into Development. QA saves evidence and waits with
`needs_input`; it must not schedule or perform repairs itself. In an authorized
full build, use the project's bounded Development queue, keep failed QA parked,
and return to the affected QA checks only after the repair has evidence. A real
dependency is repair -> QA, never QA -> repair. Do not bypass an input/review
gate with the failed-job retry action. Resume using task comments and saved
evidence after checking revision/dirty files; never run another copy of QA in
parallel in the same directory. Do not claim Experience or production assurance
for a Functional-only pass. No job-count reduction guarantees faster model
responses; report measured timings and actual coverage.

Before announcing completion, call `project_run` status and inspect
`qa_acceptance`. `needs_review` remains an open acceptance gap even when a job
is done or the Brain says verified. `reported_complete` reports coverage and
available evidence, not independent approval. A self-authored resolution note
cannot clear it. Check raw results and rerun only missing/invalid checks through
the existing bounded QA recovery; do not repeat valid unchanged journeys.
Unverified compound-command results need a direct run, not a prose PASS.
User waivers must actually come from the user and remain disclosed as limitations;
never invent approval, silently edit requirements, or present a waiver as a
passed test. Required NFRs still apply when Experience QA is unselected.
