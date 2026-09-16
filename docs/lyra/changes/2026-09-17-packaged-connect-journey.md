# Packaged first-run connection journey

Problem: packaged smoke accepted the setup choice but never clicked Connect or
verified authenticated chat. Passing fake boot was not evidence of this journey.
Scope: new isolated packaged test, real backend/auth transport, local mock model,
UI first-run connection and persisted-chat reload. Existing fake-boot smoke stays.
Acceptance: wrong token cannot enable Apply; correct token can connect; a model
reply arrives and survives reload. No production install, config or credentials.
CI's packaged job must install backend dependencies and explicitly run this spec.
Verification: local macOS package built; journey passed (8.5 seconds), including
wrong-token WebSocket rejection, correct-token connection, actual model request
and reply restoration without a new request. E2E TypeScript check passed.
Initial test failures were assertion mistakes (actual auth error wording and
reply text also appearing as a generated title); production behavior unchanged.
Combined Python regression sweep: 1,050 passed across 73 gateway/builder/budget/
usage/dispatcher/worker-recovery files. Studio smoke also passed separately.
Final 0.19.59 working-tree package: all five launch/connection tests passed
(10.4 seconds); this unsigned local test package is not a published installer.
Compatibility: tests/CI only. Revert this release for rollback; no data migration.
This cannot establish real-provider uptime or multi-hour suspend/resume stability.
User authorized separate version/commit/push for each fix.
