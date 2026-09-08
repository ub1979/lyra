# Codex auxiliary timeout fence — 2026-09-09

Change / date: Make the Codex auxiliary compression deadline a real wall-clock
bound, 2026-09-09.

User problem and reproduction: In the saved Hello project conversation, a
reply at 23:59 entered automatic context compression. The configured/effective
deadline was 300 seconds, but at 00:05 the request was still waiting with no
completion or timeout event. The same session had previously spent 600 seconds
inside a call whose eventual error claimed a 300-second total timeout. The
timeout timer called the shared HTTP client's synchronous `close()` before the
blocked stream consumer could return; when that cleanup blocked, the caller
remained stuck past its advertised deadline.
The first failure then armed only a 60-second retry cooldown despite consuming
the 300-second compression budget, so the user's next reply three minutes later
immediately entered the same failing path and waited another ten minutes.

In scope / explicitly deferred: Supervise the complete Codex auxiliary
Responses request (request creation plus event consumption) from the calling
thread. At the deadline, evict the cached client immediately, start best-effort
network cleanup without waiting for it, and return the existing `TimeoutError`.
Start the retry cooldown at the full compression budget and escalate later
timeout failures, so an immediate follow-up reply uses the preserved transcript
instead of repeating the failed compression.
Preserve successful streaming, progress callbacks, atomic compression
protection, provider fallback, and conversation data. Do not change compression
deadlines, model selection, summary content, or the main-agent request timeout.

Acceptance criteria: A silent auxiliary Responses stream cannot hold the caller
past its total deadline even when both stream consumption and client cleanup
block. A successful stream still returns its response. Timeout cleanup remains
best effort and the poisoned cached client is evicted before another call can
reuse it. A follow-up turn inside the full-budget cooldown does not launch the
same known-failing compression request again.

Affected modules and data: `agent/auxiliary_client.py`, its focused behavioral
tests, the Lyra changelog, maintenance map, and generated file inventory. No
database, project, or conversation migration.

Tests and observed results: A deterministic silent-stream reproduction now
proves that an iterator and client close which both outlive the deadline cannot
hold the caller past it. The Codex auxiliary suite passed 364 tests (with one
host-credential-specific JWT test excluded because it reads the machine's real
credential instead of its temporary test home). Another 66 compression,
gateway sync, 413 recovery, Studio workflow, and Studio wait-event tests passed.
Ruff and `git diff --check` passed. The live saved reply was preserved and the
project worker resumed; restart/resume validation remains until that active
worker reaches a safe boundary.

Compatibility / restart: The dashboard process must restart to load the fix.
The saved conversation and the user's pending reply remain intact.

Rollback / retained recovery data: Revert the focused local commit. No user
data is rewritten by this change.

Local commit / authorized push: Local repair authorized by the user's request
to diagnose and fix the recurring Lyra stall. No push or release is authorized
yet.
