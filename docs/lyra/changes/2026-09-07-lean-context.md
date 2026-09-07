# Lean Studio context — 2026-09-07

## Problem and scope

The coordinator receives the general coding toolset while interviewing users.
Repeated full job reports also grow conversation history. The context estimate
omits startup instructions appended at request time.

Keep Project Brain, memory/history retrieval, full specialist playbooks, browser
and file capabilities, approvals, model routing, and durable job recovery.
Do not modify notifications, existing historical messages, compression policy,
or running workers. No new model tools or automatic per-turn summaries.

## Acceptance criteria

- Default Studio coding coordinators use a fixed smaller toolset. Explicit
  tool overrides, non-Studio agents and worker toolsets remain unchanged.
- Memory, requirements interviewing, research, prototypes and durable job
  dispatch remain possible; tools do not change when the phase changes.
- A short read-only job summary preserves exact counts, freshness and attention
  signals, explicitly reports omitted details, and never implies product approval.
- Context estimates include request-time instructions without changing prompts.

## Affected modules / data / recovery

Gateway construction policy, toolsets, project-run CLI summary, coordinator
instructions and context accounting. No data migration or project edits.
Rollback by reverting the Lyra commit; detailed status remains available.
New tool selection requires a new agent instance; existing jobs are not restarted.

## Verification and release

269 distinct tests passed across 20 focused Python test files, using the canonical test
runner. Includes real temporary SQLite/CLI status and isolation, approved-job
subprocess/reconnect/review lifecycle, provider retry, Project Brain, prompt
caching/restoration, worker toolsets and coding-context configuration.
The initial pause test incorrectly expected a dependent `todo` job to be paused;
corrected it to the real contract (the running predecessor pauses, dependent work
stays queued). All reruns passed. Scoped Ruff and whitespace checks passed.

Local schema measurement with unavailable services gated out: general coding
plus project tools 41,367 characters / 18 tools; guide 27,017 / 13 tools (34.7%
smaller). Character/4 estimates are about 10,342 versus 6,754 tokens. This is
not the exact live provider payload or a promised billing reduction. Configured
optional plugins remain enabled; full browser/research capabilities are retained
when their services are available. Memory and session-history search are kept
despite their size because losing retrieval would undermine quality.

A 111-job synthetic report containing long historical errors shrinks by over
90%, while counts, attention, omissions and freshness remain explicit. Small
projects may not produce smaller reports. No provider/cache configuration was
changed: existing cache support remains enabled, without per-turn memory reloads,
schema changes, or repeated AI summarization. No paid-model quality benchmark
or whole-repository release certification is claimed.

Local commit after verification. Not pushed or activated in the running Lyra.
No version bump until the next authorized release change set.
