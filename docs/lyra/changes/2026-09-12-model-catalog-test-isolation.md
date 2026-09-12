Change / date: Model-catalog test isolation / 2026-09-12
User problem and reproduction: Release verification found two OpenRouter picker tests whose fixed expected fixtures were still filtered through the machine's cached remote curated catalog. When that catalog omitted one fixture model, both tests failed even though their supplied live API response contained it.
In scope / explicitly deferred: Pin the remote curated catalog out in the two fixture-driven tests, matching the isolation already used by the sibling tool-support test. Do not change production catalog fetching, filtering, or model availability.
Acceptance criteria: Both tests derive results only from their local fixtures and pass independently of remote/disk catalog contents; production code remains unchanged.
Affected modules and data: `tests/hermes_cli/test_models.py` only. No runtime or persisted data changes.
Tests and observed results: Pre-change full model tests had 86 passes and these 2 failures. After isolating the curated catalog input, all 88 model tests passed and the combined 688-test release run completed with zero failures.
Compatibility / restart: None; test-only change.
Rollback / retained recovery data: Revert the focused commit; no recovery data exists.
Local commit / authorized push: User previously authorized pushing Lyra modifications; included in the verified v0.19.36 release commit.
