Change / date: Responsive project coordinator / 2026-09-12

User problem and reproduction:
A user reported a concrete wrong search result in an existing guided project.
Lyra loaded debugging and development playbooks, inspected and edited the
application, and ran its checks inside the foreground conversation. The user
only saw “Lyra is working” for several minutes, including a long context
compression, and could not get a prompt acknowledgement or an explanation of
which agent owned the report. The report was also not explicitly classified as
an in-scope bug before work began.

In scope / explicitly deferred:
Add a live project-execution routing directive to new and saved Studio
conversations. Concrete wrong-behaviour reports must be checked against the
approved brief, routed first to Debugging for reproduction and root cause, then
to Development for a fix, and finally to QA for independent verification of the
exact reported journey. Non-interactive work must run as durable project jobs;
the foreground conversation remains a responsive coordinator and replies as
soon as a job is queued. Requirements is used only when the expected behaviour
is genuinely outside or unclear in the approved brief. Generated user-project
code, worker implementation, and a second chat surface are explicitly deferred.

Acceptance criteria:
- Normal sends, retries, and automatic phase continuations carry the current
  execution-routing rule, including for conversations saved before this fix.
- The coordinator may inspect project status and queue work, but must not load
  specialist playbooks, edit application files, run application test suites, or
  perform a non-interactive specialist phase in the foreground conversation.
- An in-scope concrete bug is owned first by Debugging, followed by Development
  and independent QA using the user's exact reproduction.
- A genuinely new or unclear expectation returns to Requirements; ordinary
  in-scope feedback does not.
- Only the user's confirmed agents may be queued. A missing required agent is
  proposed to the user rather than silently activated.
- After a durable job is accepted, Lyra immediately tells the user which agent
  owns it, what it is checking, and that it will continue in the background.

Affected modules and data:
`web/src/lib/guided-agent-routing.ts`, the Studio guided-chat prompt composition,
the Ultimate Builder coordinator instructions, focused routing tests, generated
dashboard assets, Lyra release metadata, changelog, and file inventory. No
project data, credentials, conversation history, or database schema changes.

Tests and observed results:
The routing and phase-handoff regressions were first observed failing, then
passed after implementation. The final complete Studio web check passed 51
files and 411 tests with zero lint errors (31 unchanged warnings). All 110
Ultimate Builder tests passed. Nine Lyra independence and
version tests plus two authenticated version-endpoint checks passed. The
production Studio build completed successfully. File-map, generated dashboard
asset parity, and whitespace checks are rerun against the final staged diff.

Compatibility / restart:
The rule is appended to each new user turn, so it repairs old saved
conversations without rewriting their cached history. Reload Studio after the
Lyra process is updated. Do not restart or interrupt the user's currently active
Urdu-project work while it is running.

Rollback / retained recovery data:
Revert the focused Lyra commit. Existing projects, sessions, project jobs,
credentials, and generated user-project changes remain untouched.

Local commit / authorized push:
The user has already authorized pushing Lyra modifications. Commit and push
only this Lyra change after all required checks pass.
