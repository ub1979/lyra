# Bounded local-provider supervision — 2026-09-08

Change / date: Bound implicit local-provider waits without restoring premature browser cancellation, 2026-09-08.

User problem and reproduction: Studio now trusts the backend's 30-second supervised-wait heartbeat, but non-streaming calls to an implicitly configured local endpoint still resolved their stale timeout to infinity. A wedged Ollama, LM Studio or llama.cpp request could therefore keep emitting backend heartbeats forever. Suppressing those heartbeats would make Studio's 125-second browser watchdog interrupt healthy local prompt prefill, which is known to take more than 300 seconds on slower hardware.

In scope / explicitly deferred: Give implicit non-streaming local calls the same finite 900-second ceiling already used for local streaming calls, preserve the existing `agent.local_stream_stale_timeout` and `HERMES_LOCAL_STREAM_STALE_TIMEOUT` overrides, reject non-finite local override values, and clarify the heartbeat contract. Do not change cloud-provider timeout tiers, Studio's 125-second silence threshold, explicit provider/model stale timeouts, prompt history or toolsets.

Acceptance criteria: Healthy local calls can remain silent beyond 125 and 300 seconds without browser cancellation while supervised heartbeats continue. A silent local call with implicit timeout configuration is reclaimed by the backend after the finite local ceiling. Existing local timeout configuration applies consistently to streaming and non-streaming calls. Explicit provider/model stale timeouts retain priority. Invalid or infinite local-ceiling overrides cannot create an unbounded heartbeat.

Affected modules and data: Local timeout resolution in `run_agent.py`, the shared streaming caller, timeout defaults/documentation, Studio heartbeat documentation, focused timeout tests and the generated Lyra file inventory. No persistent data, schema, session, project or user-message changes.

Tests and observed results: Eight focused Python files passed 168 tests covering timeout configuration, non-streaming resolution, streaming supervision, wait notices, Studio event tagging and Codex watchdog behavior. The 28-test Studio watchdog suite and Studio typecheck passed. Ruff passed on every changed Python file with one pre-existing malformed-noqa warning in `run_agent.py`. The searchable file inventory was regenerated for the new maintained change record; unrelated untracked scratch paths emitted by the generator were deliberately excluded from the saved index.

Compatibility / restart: Backend processes must restart to use the finite non-streaming local ceiling. Existing configuration remains compatible; the historical `agent.local_stream_stale_timeout` key now covers both local call modes.

Rollback / retained recovery data: Revert the focused local commit. No data migration or recovery data is involved.

Local commit / authorized push: Local commit only. No push or release authorized; therefore no Lyra version bump.
