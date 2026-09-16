# Coordinator context compaction

Problem: proactive pruning rewrites old tool messages without the normal
compression summary/memory handoff. The 32 KB aggregate limit also exempts all
inline-capped reads, allowing a batch of many reads to exceed it.
Scope: first repair cache/memory behavior with Hermes's existing compression
path. Disable coordinator-only proactive pruning; cap full compression at 100k
tokens (respect tighter existing settings), preserving summary and memory hooks.
Abort compression on summary failure instead of dropping unsummarized history.
The aggregate read-admission issue is explicitly separate, not claimed fixed.
Acceptance: historical messages stay byte-identical below compression; threshold
cap survives model changes; user memory/Project Brain remain authoritative sources;
workers and external context engines are not reconfigured.
Tests: 241 tests passed across actual compressor thresholds/cache preservation,
existing compression, memory handoff and anti-thrash recovery. All 463 web tests,
typecheck/build passed; lint zero errors (30 existing warnings). No live-provider
latency claim; compression calls were controlled in tests.
Compatibility: backend restart/new conversation; no history migration or user
memory rewrite. Compression uses a summary call and is not guaranteed lossless.
Rollback: revert this policy. User authorized separate version/commit/push.
