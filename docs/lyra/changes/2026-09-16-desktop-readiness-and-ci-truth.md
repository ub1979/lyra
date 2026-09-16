# Desktop readiness sentinel and a truthful CI — 2026-09-16

Change / date: the desktop app recognises the readiness line the backend
actually prints, and the four CI failures that had been red since at least
0.19.40 are fixed at their causes; 16 September 2026 (evening, after the
0.19.45 push showed the first CI run the user inspected).

User problem and reproduction: the user checked the CI logs for run
35127478085 and found that the same jobs failed on every recent release —
"Python tests / Generate slices", "Windows footguns", three
`apps/desktop` check scripts, and the Desktop E2E job cancelled at its
20-minute limit — and that the readiness failures were "a real production
protocol mismatch, not just stale tests". Reproduction of the core defect:
`hermes_cli/web_server.py` prints `IDRAK_IT_DASHBOARD_READY port=<n>` (or
`IDRAK_IT_BACKEND_READY` for `hermes serve`); `apps/desktop/electron/
backend-ready.ts`, `remote-lifecycle.ts` and `windows-remote-lifecycle.ts`
matched `^HERMES_(?:BACKEND|DASHBOARD)_READY port=`. The rebrand commit
`f52bd7f9a` (2026-07-26) replaced whole `HERMES_*_READY` literals — comments
and tests included — but skipped the regexes because they were written with
an alternation. `backend.readyFile` is never assigned anywhere, so the stdout
line is the desktop's only way to learn the port of a backend it spawns: the
wait timed out after 90 s, every launch. The Electron E2E suite showed the
same thing in the large: `boot.spec.ts › backend boots and app becomes
ready` and every spec after it burned its ready timeout, which is why the
job never finished in 20 minutes.

In scope / explicitly deferred:
- Readiness: all three Electron patterns and `scripts/iso-certify.py` accept
  `(?:IDRAK_IT|HERMES)_(?:BACKEND|DASHBOARD)_READY port=(\d+)` — the legacy
  spelling stays accepted so a remote install from before the rename can
  still be adopted. New `tests/hermes_cli/test_ready_sentinel.py` reads the
  token from `web_server.py` and the pattern from each listener's source and
  matches one against the other, so the two languages cannot drift apart
  silently again.
- File index: `scripts/lyra_code_map.py` inventories tracked files only
  (`git ls-files --cached`); the committed index had ten rows for files that
  existed only on the generating machine (`_to_delete/`, `Claude outputs/`,
  `pnpm-*.yaml`), so `--check` failed in CI and, because the slice generator
  runs it first, the whole Python unit-test matrix was skipped. Test:
  inventory of a temporary repository excludes an untracked file.
- Encoding: 28 `read_text()` / `write_text()` calls in
  `plugins/ultimate-builder/tests/{test_plugin,test_plugin_api,
  test_project_progress}.py` now pass `encoding="utf-8"`; the
  Windows-footgun lint reports 0 findings (851 files).
- Desktop test copy: `desktop-install-overlay.test.tsx` (11 tests),
  `streaming.test.tsx`, `use-billing-state.test.ts`, `billing/index.test.tsx`,
  `e2e/boot.spec.ts` and `e2e/launch-packaged-app.spec.ts` now expect the
  strings `en.ts`, `errors.ts` and `index.html` actually contain ("Set up
  Lyra", "Connect to existing Lyra", "Lyra is loading a response", "… from
  the account portal.", title "Lyra") instead of the pre-rebrand "Hermes"
  copy.
- Packaged-app validation: `check:test:desktop:all` is removed from
  `apps/desktop/package.json` because `js-tests.yml` auto-discovers every
  `check:*` script and ran it on a checkout with no packaged binary
  ("Missing packaged app binary: release/linux-unpacked/Hermes"). The
  coverage moves to a new `packaged` job in `e2e-desktop.yml` that runs
  `node scripts/test-desktop.mjs all` (pack + validate the bundle) and the
  `launch-packaged-app.spec.ts` smoke under xvfb, separate from the E2E job
  so a red package never masks the E2E result. The local `check` chain still
  calls `test:desktop:all`.
- Deferred: the E2E job's `timeout-minutes` stays at 20 — the diagnosis
  says the time was spent in ready timeouts, so the next CI run measures the
  real duration before any number changes. Two `billing/index.test.tsx`
  tests ("rejects auto-refill amounts…", "disables buy controls while
  polling…") fail on this macOS checkout at `HEAD` as well but pass in CI;
  left alone as a local-environment difference to look at separately.

Acceptance criteria: the readiness unit tests pass; the sentinel contract
test matches all four listeners against both printed tokens; the
footgun lint is clean; `lyra_code_map.py --check` passes on a clean
checkout; the fixed desktop unit tests pass; web and desktop typecheck and
lint report 0 errors; the Studio smoke still passes after the dependency
reinstall.

Affected modules and data: `apps/desktop/electron/backend-ready.ts`,
`remote-lifecycle.ts`, `windows-remote-lifecycle.ts`, `scripts/iso-certify.py`,
`scripts/lyra_code_map.py`, `docs/lyra/file-index.tsv`, `docs/lyra/CODE_MAP.md`,
`plugins/ultimate-builder/tests/*` (encodings only), six desktop test files,
`apps/desktop/package.json` (script removed), `.github/workflows/e2e-desktop.yml`
(new job), new tests `tests/hermes_cli/test_ready_sentinel.py` and
`tests/test_lyra_code_map.py::test_inventory_lists_tracked_files_only`. No
runtime Python change, no web bundle rebuild, no stored data changes.

Tests and observed results (local, macOS):
- `vitest --project electron`: 727 passed, 0 failed, 2 skipped (before:
  12 failed in `backend-ready.test.ts` and `remote-lifecycle.test.ts`).
- `vitest --project ui` on the four fixed files: the 14 CI failures are
  gone (92 of 94 pass; the two remaining are the pre-existing local-only
  failures noted above).
- `scripts/run_tests.sh tests/hermes_cli/test_ready_sentinel.py
  tests/test_lyra_code_map.py plugins/ultimate-builder/tests -q`: 133 passed.
- `python scripts/check-windows-footguns.py --all`: 0 findings.
- `python scripts/lyra_code_map.py --check`: current; 10 untracked rows gone.
- `npm --prefix web run check`: 454 tests, 0 lint errors;
  `npm --prefix apps/desktop run check:lint`: typecheck clean, 0 lint errors.
- Studio Playwright smoke: 1 passed after `npm ci --ignore-scripts`; the
  user's dashboard on 9119 still answers 200.
- Not verifiable locally: the new `packaged` job and the Electron E2E
  duration — the first CI run after the push decides both.

Compatibility / restart: desktop users relaunch the app; Studio users
restart Lyra and reload once. Remote SSH mode keeps working against older
backends because the legacy token is still accepted.

Rollback / retained recovery data: revert the commits; nothing stored
changes. Reverting the readiness fix reintroduces the 90 s launch timeout.

Local commit / authorized push: local commits `fix(desktop): recognise the
Idrak IT readiness sentinel`, `test(desktop): follow the Lyra copy`,
`fix(ci): reproducible file index, UTF-8 test helpers, packaged job` and
`chore(release): bump Lyra to 0.19.46`; push follows the standing release
instruction.
