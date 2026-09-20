Change / date: Studio progress, stop reasons, usage and team selection / 2026-09-20

User problem and reproduction:
Project chats need five-minute progress check-ins. Stored Development events
record iteration exhaustion (90/90), but notifications discard the reason.
The headline token counter excludes durable workers. A controlled SQLite
reproduction also counts 1,800 cumulative tokens as 3,000 when one run rotates
session IDs. Launcher instructions recommend teams even after manual selection.
New project chats need a deterministic opening invitation.

In scope:
Reuse the existing chat submission path for guarded five-minute check-ins;
explain event-specific stops without changing retries; combine reported usage
with a clear breakdown; preserve run identity across compression; retain manual
team choice and allow recommendations only for explicit guided selection; show
the requested opening text without a model call.

Acceptance criteria:
- Check-ins happen only during active work in an available project chat, never
  interrupt an active turn or answer an approval, and do not erase drafts.
- Duplicate tabs/reconnects do not produce catch-up bursts.
- Stop messages identify recorded budget/time/process reasons and current next
  steps; missing evidence stays unknown.
- Usage retains completed/retried work, counts cumulative run snapshots once,
  and labels missing reports. Presentation does not change billing counters.
- Manual/custom teams remain authoritative across startup/resume; only explicit
  guided selection can open a recommendation. Confirmation closes that gate.
- A fresh chat displays "whats the great idea you wanna build" without inference.

Affected modules and data:
Studio helpers/hooks/reducer and ChatPage; builder launcher; saved-job notification
adapter and formatter; usage reader and project-run presentation. No migration,
live job changes, budget changes or historical prompt rewrites.

Tests and observed results:
- Complete web check: 502 tests passed; typecheck passed; lint has zero errors
  and 30 existing warnings. Production dashboard build passed.
- Relevant Python gateway/notification/usage suites and full builder plugin
  suite: 831 tests passed across 34 files. After final explanation wording,
  notification-focused checks passed again (22 tests).
- Compact status/real project-run tool checks: 11 passed; historical worker
  usage stays out of the short model-facing status response.
- Real Chromium Studio smoke: all four scenarios passed (ordinary chat/token
  display and cold resume; supplied brief submitted once; empty guided launch;
  custom selection plus automatic check-in through the real PTY). The custom
  scenario passed separately after correcting two test selectors: click the
  visible checkbox label, and locate the labelled check-in inside its chat
  wrapper. Uses a temporary profile, projects and echo provider, not a live
  project-building acceptance trial. Final timer unit tests also cover a full
  interval after resume; production build and focused new-module lint passed.
- Browser test prerequisites: the default command found a Python Playwright CLI
  because desktop test dependencies were absent. Reused cached pinned JS
  Playwright 1.58.2 in ignored node_modules. Sandbox Chromium/socket restrictions
  required the same isolated smoke to run outside the sandbox.
- Release 0.20.0 checks: 23 version and builder-dashboard tests passed; both
  dashboard copies passed syntax and byte-parity checks; the maintained file
  inventory check and production web build passed.
Compatibility / restart: Rebuilt dashboard and updated backend required. Do not
restart active user work. Existing saved data remains readable.
Rollback / retained recovery data: Revert the focused commit; no data migration.
Local commit / authorized push: Implementation commit `8b722c134`. The user
authorized a push on 2026-09-20; release metadata is synchronized as Lyra
0.20.0 beta in the following release commit.
