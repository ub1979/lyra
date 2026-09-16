# Packaged app name and a visible index check — 2026-09-16

Change / date: everything that looks for the packaged desktop executable reads
its name from the desktop package configuration, and the file-index freshness
check becomes its own CI job; 16 September 2026 (late night, follow-up to
0.19.46 after its first CI run).

User problem and reproduction: the new `packaged` job from 0.19.46 packed the
app successfully and then failed with `Missing packaged app binary:
release/linux-unpacked/Hermes`. `apps/desktop/package.json` sets
`productName` and `build.executableName` to `Lyra` (rebrand `f52bd7f9a`), so
electron-builder produces `Lyra`, `Lyra.exe` and `Lyra.app`; four places still
hardcoded `Hermes`: `scripts/test-desktop.mjs`, `e2e/fixtures.ts`
(`PACKAGED_BINARY_PATH`), `hermes_cli/main.py::_desktop_packaged_executable`
(the `hermes desktop` launcher) and `hermes_cli/gui_uninstall.py`
(`packaged_gui_app_paths`). Reproduction for the launcher: pack the app, run
`hermes desktop`, observe that no packaged executable is found. Separately,
the user's audit asked that an inventory failure should not suppress the
whole Python suite: `--check` ran inside "Generate slices", so a stale index
skipped every test slice (0.19.40 → 0.19.45).

In scope / explicitly deferred:
- `test-desktop.mjs` and `e2e/fixtures.ts` derive the executable and
  installer prefix from `package.json` (`build.executableName` →
  `productName` → `name`); the bundle check now lists what electron-builder
  produced when the binary is missing.
- `hermes_cli/main.py`: `_desktop_executable_names()` returns the configured
  name first, then the pre-rebrand `Hermes` (lower-cased variants on Linux,
  where electron-builder lower-cases a default name);
  `_desktop_packaged_executable` iterates those names per platform. The
  Windows architecture preference is unchanged.
- `hermes_cli/gui_uninstall.py`: install locations for both `Lyra` and
  `Hermes` so an old install is still removable.
- `tests.yml`: new `file-index` job runs `lyra_code_map.py --check`; the
  "Generate slices" step no longer does. Still blocking for the required
  checks, but the matrix runs regardless.
- Deferred: `scripts/before-pack.mjs` keeps `Hermes.exe` as a fallback
  default — the real run receives the product name from electron-builder's
  context and its tests pass the name explicitly; the E2E job timeout is
  unchanged pending the measurement from the 0.19.46 run.

The Python matrix ran again in the 0.19.46 CI run — for the first time since
before 0.19.40 — and exposed eleven failures in eight files that the skipped
matrix had hidden. Each fixed at its cause (all are in this change set):
- `tests/hermes_cli/test_dashboard_admin_endpoints.py::TestUpdateCheckEndpoint`
  (6): upstream tests for `GET /api/hermes/update/check`, which Lyra
  deliberately answers with 404 ("disabled for this private distribution").
  Replaced by two tests of Lyra's contract: the endpoint refuses without
  probing the install method, and `GET /api/lyra/version` carries the update
  signal.
- `tests/skills/test_guided_agent_roster.py`: still required a
  `GUIDED_SPECIALIST_ETA_SECONDS` map that `7e89a305b` (2026-09-05) removed
  with the durable-agent feed. The test checks descriptions only now.
- `tests/hermes_cli/test_dashboard_auth_gate.py`: expected the pre-rebrand
  `__HERMES_SESSION_TOKEN__` global; the server injects and `web/src/lib/api.ts`
  reads `__IDRAK_IT_SESSION_TOKEN__` (they agree — test drift only).
  `tests/plugins/test_plugin_dashboard_auth_contract.py` now forbids both
  spellings so the guard is not defeated by a rename again (plugin bundles
  mention the old name only in a comment).
- `tests/tools/test_windows_native_support.py`: demanded that README point at
  `scripts/install.ps1`; that script clones upstream `NousResearch/hermes-agent`,
  so Lyra's README must not send Windows users there. The assertion is
  inverted with the reason recorded.
- `tests/test_lyra_git_guard.py`: CI runners have no git identity, so the raw
  `git commit` failed with "Author identity unknown" instead of the guard —
  the test's identity env is now used for every git call.
- `tests/hermes_cli/test_managed_uv.py::test_self_update_success`: predates
  the runtime-repair hook (2026-07-24) that adds a third subprocess call; it
  stubs the hook like its sibling test does.
- `gateway/run.py` (real code, from `4aeeaa29f7` 2026-08-30): two SessionDB
  calls inside `asyncio.gather` were functionally awaited but failed the
  gateway's static rule that every `self._session_db.<method>()` is awaited
  directly. Rewritten as two sequential awaits; `test_telegram_topic_mode.py`
  and `test_compression_failure_session_sync.py` still pass.

Two local-only observations, not remediated: `billing/index.test.tsx` has
two tests that fail on this macOS checkout at `HEAD` but pass in CI.

Acceptance criteria: launcher lookup finds `Lyra` on Linux, Windows and macOS
layouts and still finds a pre-rebrand `hermes` tree; uninstall candidates list
`Lyra` before `Hermes`; existing Windows integrity tests unchanged and green;
desktop typecheck clean; ruff and footgun lint clean.

Affected modules and data: `hermes_cli/main.py`, `hermes_cli/gui_uninstall.py`,
`apps/desktop/scripts/test-desktop.mjs`, `apps/desktop/e2e/fixtures.ts`,
`.github/workflows/tests.yml`, new `tests/hermes_cli/
test_desktop_packaged_executable.py`, extended `tests/hermes_cli/
test_gui_uninstall.py`, `docs/lyra/CODE_MAP.md`. No stored data changes.

Tests and observed results: `scripts/run_tests.sh
tests/hermes_cli/test_desktop_packaged_executable.py
tests/hermes_cli/test_desktop_exe_integrity.py -q` and
`tests/hermes_cli/test_gui_uninstall.py` green (one assertion changed to
`samefile` because macOS is case-insensitive and reports `Hermes` for a
`hermes` file); ruff "All checks passed"; footgun lint 0 findings; desktop
`typecheck` clean; `node --check scripts/test-desktop.mjs` OK. The eleven
repaired Python tests: `scripts/run_tests.sh` on the eight files plus
`tests/gateway/test_telegram_topic_mode.py` and
`tests/gateway/test_compression_failure_session_sync.py` — 306 passed, 0
failed. Measured in the 0.19.46 CI run (35147974548): the Electron E2E suite
now finishes in 3.2 min with 37 passed / 7 skipped / 0 failed (it timed out at
20 min before the readiness fix), so `timeout-minutes` stays at 20; the
Studio smoke passed again (7.8 s); `check:test:ui` and
`check:test:desktop:platforms` are green. The packaged CI job and the new
`file-index` job are verified by the run after this push.

Compatibility / restart: none for Studio. Desktop users on an old `Hermes`
install are still found by `hermes gui uninstall`.

Rollback / retained recovery data: revert the commit.

Local commit / authorized push: local commits `fix(desktop): find the packaged
app under its configured name` and `chore(release): bump Lyra to 0.19.47`;
pushed after the 0.19.46 CI run completes, so its E2E measurement is not
cancelled by the new push.
