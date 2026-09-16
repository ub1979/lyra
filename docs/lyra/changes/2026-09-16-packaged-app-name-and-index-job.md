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
`typecheck` clean; `node --check scripts/test-desktop.mjs` OK. The packaged
CI job and the new `file-index` job are verified by the run after this push.

Compatibility / restart: none for Studio. Desktop users on an old `Hermes`
install are still found by `hermes gui uninstall`.

Rollback / retained recovery data: revert the commit.

Local commit / authorized push: local commits `fix(desktop): find the packaged
app under its configured name` and `chore(release): bump Lyra to 0.19.47`;
pushed after the 0.19.46 CI run completes, so its E2E measurement is not
cancelled by the new push.
