Change / date: Shell verification evidence, 2026-09-18
User problem and reproduction: `npm test | tail` can exit zero after failed tests; the verification ledger currently labels any matching zero-exit command passed.
In scope / explicitly deferred: Classify compound/redirected shell commands conservatively and reinterpret existing ledger events on read. No global shell option changes.
Acceptance criteria: A failed test masked by a zero-exit pipeline, fallback, suffix command or redirection is not passed; direct successful tests still pass. Quotes and Windows-style separators are covered.
Affected modules and data: `agent/verification_evidence.py`, tests, existing SQLite event reads. No schema change.
Tests and observed results: 71 focused evidence/verify-on-stop tests passed via `scripts/run_tests.sh`; Ruff passed. The real shell fixture exited 0 after a test script exited 7, and the ledger reported unverified.
Compatibility / restart: Existing evidence rows remain readable; questionable past passes are treated as unverified when queried.
Rollback / retained recovery data: Revert this classification change; ledger rows are retained.
Local commit / authorized push: `4682b0d76`; not pushed.
