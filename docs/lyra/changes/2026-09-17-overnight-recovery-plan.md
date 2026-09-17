# Overnight recovery and latency — implementation plan

## Evidence and scope

Hello's empty-chat startup took 7m56s over 16 model calls. Opening Studio
automatically submitted a hidden setup request; instructions to greet before
tools did not enforce that order. Individual later provider calls also lasted
4–6 minutes. Removing startup inference does not bound provider latency.

Other observed failures: blocked jobs could not be individually recovered via
the coordinator tool; old completed reviews were reused; accepted review did
not release the reviewed job; iteration budgets were exhausted; quota exhaustion
was retried; an approval expiry appeared as denial. Shell pipeline exit masking
and idle steer delivery are investigation items, not confirmed root causes.

## Ordered, independently released changes

1. No inference on empty-chat open. Keep the composer available; send setup
   context with the user's first actual request, preserving the existing PTY
   transport. No fabricated assistant answer or claim of inspecting files.
2. Task-scoped recovery through the existing Kanban unblock API, with workspace,
   role, dependency and review guards. Never stop/replan the entire project to
   recover one job.
3. Review freshness and acceptance: bind review to the exact implementation
   and revision; only matching evidence can release its review gate.
4. Separate exhausted quota from transient rate limiting. Stop futile automatic
   retries without changing the user's provider or spending on another account.
5. Distinguish expired approval from explicit denial. Check iteration-budget
   continuation and truthful completion summaries with concrete reproductions.

## Acceptance, design and tests

New modules have one responsibility and stay below 400 lines. Existing large
integration files receive only scoped changes; this is not a full refactor.
Behavioral regressions and real temporary-database/transport journeys accompany
each change. Startup must issue zero model requests until actual user input;
first input must retain setup context; reconnect must not resubmit setup alone.
Recovery must not unblock unrelated projects, unmet dependencies or review gates.

No production model calls, live-job restart, provider change, data migration or
Hello source cleanup is part of verification. Preserve all partial Hello work.
Each fix gets its own versioned commit/push after its checks. Revert commits are
the recovery path. Reload rebuilt Studio assets for the startup change; backend
changes need a controlled restart after active work stops.

## Results

Step 1 implemented as 0.19.60. Setup policy is extracted into a 30-line module;
ChatPage loses its automatic startup submission and eager directory/package
inspection. Existing builder links carrying real requests remain unchanged.
Saved-history filtering also removes the execution directive, which the new
first-request recovery test exposed as previously visible.

Verification: web typecheck, 465 tests, lint (0 errors / 30 existing warnings),
production build; real Chromium/PTY/gateway/mock-provider smoke including two
turns, usage and cold reload (1 passed, 13.5s); version tests (9 passed).
The checkout lacked its pinned Playwright runner, so the browser check used
1.58.2 installed in a temporary directory, not a changed dependency manifest.

Step 2 is implemented separately as 0.19.61; see the targeted-job-recovery record.
Steps 3–5 remain pending. This is not a stability sign-off and no live process
was restarted. Real-provider time-to-first-response must still be measured
after the user restarts/reloads; no sub-second model latency is claimed.
