# Stale gateway takeover — 2026-09-11

User problem and reproduction: Suspending one `./start.sh` process and launching
Lyra again left the old gateway alive but stopped. The replacement launcher
correctly started a healthy project dispatcher and dashboard, but Telegram's
scoped token lock remained owned by the stopped PID. The new gateway retried
every five minutes and repeatedly reported that the token was already in use.

In scope / explicitly deferred: Make the launcher-owned gateway explicitly
replace an existing unhealthy gateway when the dispatcher readiness probe has
already failed. Preserve a healthy standalone gateway, which continues to make
the readiness probe succeed and therefore prevents the launcher from starting
another gateway. Do not change Telegram credentials, lock identity, retry
timing, service-managed gateways, or cron storage.

Acceptance criteria:

- A launcher-created gateway uses the existing bounded `--replace` takeover.
- A healthy dispatcher still prevents any launcher gateway from starting.
- The dashboard remains usable and the launcher cleans up only the gateway it
  started.
- The observed suspended duplicate can be removed without stopping the current
  dashboard or losing cron jobs.

Affected modules and data: `start.sh` and its focused launcher regression test.
No user project, credential, conversation, Telegram, or cron data is changed.

Tests and observed results: The launcher regression first failed against the
old command and passed after adding the takeover flag. All 172 focused Python
tests covering the launcher, product version, scoped platform locks, takeover,
child reaping, status, and external supervision passed, followed by all 110
Ultimate Builder tests. The 9 web version tests, web TypeScript check, and web
production build passed; the build retained its existing large-bundle warning.
Shell syntax, dashboard source/build parity, changed-file whitespace, and the
regenerated Lyra file map also passed. In the reported live process tree, the
exact suspended launcher group was terminated; the current gateway then
reclaimed Telegram on its next retry while the dashboard and cron dispatcher
remained running.

Compatibility / restart: Existing healthy launches are unchanged. A future
restart loads the hardened launcher; the currently running gateway can recover
as soon as the stale Telegram lock owner exits.

Rollback / retained recovery data: Revert the focused commit. No data migration
or deletion is involved.

Local commit / authorized push: The user instructed that Lyra modifications be
pushed. This record is included in the focused v0.19.36 release commit.
