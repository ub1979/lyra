# Stability fixes — 17 September 2026

Each row is an independently versioned commit and push, as requested.

| Release | Responsibility | Evidence |
|---|---|---|
| 0.19.52 | Provider-address edit notice; no automatic retargeting | Rendering test; 463 web tests/check/build |
| 0.19.53 | Retry failed usage snapshots, 30s minimum interval, saved timestamp | 15 accounting/real SQLite tests; web suite |
| 0.19.54 | Construction-time coordinator exclusions; subprocess dispatch gate | 595 gateway/project tests plus constructor regression |
| 0.19.55 | Normal Hermes compression/memory handoff, no proactive history pruning | 241 compression/memory/policy tests |
| 0.19.56 | Admit whole documents within inline read-batch budget | 108 budget/storage/invariant tests |
| 0.19.57 | Post-commit dispatcher wake signal, polling fallback | 278 queue/daemon/claim tests |
| 0.19.58 | Production cross-platform worker liveness probe in test | 22 signal/stop/workflow tests; Studio cold reload smoke |
| 0.19.59 | Actual packaged first-run connection/chat/reload journey | All 5 local macOS packaged tests passed; CI wired |

Final combined Python sweep: **1,050 passed**, 73 files. This overlaps the focused
counts above; do not add them as unique tests. An additional **539 web-server tests
passed** against final auth/version behavior. Web check: **463 passed**, typecheck
and build successful, zero lint errors and 30 existing warnings. New implementation
modules are single-purpose and under 400 lines. Existing large files received
small integration edits; this was not a wholesale refactor of the repository.

## Remaining limits — not an “everything is fixed” sign-off

- CI is green for 0.19.51–53; some intermediate runs were superseded by later
  pushes. Check the final release's exact SHA/run before deployment sign-off.
- Packaged connection is locally verified on macOS; its new Linux CI execution
  must still complete. No Windows package journey was run locally.
- No hours-long real-provider, quota/outage or machine suspend/resume soak was
  performed. No production latency/uptime percentage is justified.
- Usage snapshots are not streaming telemetry or exact post-crash billing.
- Compression uses summaries and is not lossless; Project Brain, source documents
  and Hermes memory remain the durable reference. Context budgets do not bound
  the entire request including system text, tools and all uncapped outputs.
- Coordinator exclusions prevent accidental execution/delegation, not malicious
  access. Requirements editing remains available; worker shell access remains.

No active user process was restarted and no real-provider calls were made by
these tests. Finish/stop active work before restarting the backend; use a new
conversation for construction-time tool/context policies. Keep saved history.

Verdict: stronger evidence for supervised beta use; not unattended-production
certification. Full original audit remains in `output/lyra-audit-2026-09-16.md`.
