# Studio Playwright smoke — 2026-09-16

Change / date: a browser-level smoke test of the shipped Studio (real
dashboard, real node terminal child, real gateway, headless Chromium, echo
model); 16 September 2026 (Step 4 of the "tests that see the conversation"
plan, following 0.19.43/0.19.44).

User problem and reproduction: after 0.19.43 the Studio event fold is tested
against real gateway frames, but the `ChatPage` wiring around it — snapshot →
reduce → apply → effects, the composer, the `/api/pty` → `ui-tui/dist/entry.js`
→ gateway path and the runtime panel — had no test at all; vitest cannot render
the page. The 0.19.42 regression ("Lyra's new reply replaced the previous one")
was visible only in a browser. Reproduction of the gap: search
`apps/desktop/e2e` and `web/src` for a test that opens `/chat?guided=1` — none.

In scope / explicitly deferred: one spec, `a user turn, a second turn, and the
token panel all render in Studio`, in a separate Playwright project
(`apps/desktop/playwright.studio.config.ts`, `testDir: e2e-studio`) so the
Electron specs under `e2e/` are untouched. Harness modules, one responsibility
each: `studio-dashboard.ts` spawns `hermes dashboard --port 0 --host 127.0.0.1
--no-open --skip-build` in a process group with a credential-stripped
environment and a sandbox `HERMES_HOME`, waits for `IDRAK_IT_DASHBOARD_READY
port=N`, keeps an 80-line stderr ring and kills the group on close;
`echo-model.ts` is an OpenAI-compatible server replying `Echo: <tail of the
latest human user message>` with a `usage` object (a fixed canned reply cannot
prove two turns leave two bubbles, because the conversation drops a reply
identical to the previous one by design). `e2e/fixtures.ts` exports
`stripCredentials` for reuse. CI (`e2e-desktop.yml`) installs Chromium, builds
the gitignored `ui-tui/dist` bundle and runs the smoke after the Electron run.
Deferred: notification turns (no Kanban job can complete against an echo
model — that path stays covered by the reducer's real-frame replay); the
`history_version` seam below; a `data-testid` layer (selectors use ARIA labels
and the existing `.lyra-studio-message` class).

Acceptance criteria: the spec passes locally twice in a row; the typed text
appears in a "You" bubble; a bubble containing `Echo:` and the typed text
appears for each of two turns and the first stays after the second; the Tokens
panel leaves "Not reported yet" and shows an "Updated" row; no `hermes
dashboard --port 0` or test-spawned `entry.js` process survives; the user's
live dashboard on port 9119 is untouched; `tsc -p tsconfig.e2e.json` clean.

Affected modules and data: `apps/desktop/e2e-studio/{studio-smoke.spec.ts,
studio-dashboard.ts, echo-model.ts}`, `apps/desktop/playwright.studio.config.ts`,
`apps/desktop/tsconfig.e2e.json`, `apps/desktop/package.json`
(`test:e2e:studio`), `apps/desktop/e2e/fixtures.ts` (export only),
`.github/workflows/e2e-desktop.yml`, `.gitignore` (studio report/result
directories), `docs/lyra/CODE_MAP.md`. No runtime code, no web bundle rebuild,
no stored data changes.

Tests and observed results: three consecutive local runs green (3.9 s, 7.9 s,
4.2 s test time; ~9–11 s wall) with `@playwright/test` 1.58.2 — the version
pinned in `package-lock.json` that CI installs — and Chromium headless shell
1208 on macOS. `tsc -p tsconfig.e2e.json --noEmit` clean. `npm run build -w
ui-tui` (the new CI step) verified locally to rebuild `ui-tui/dist/entry.js`.
Process check after the runs: `pgrep -f "dashboard --port 0"` empty; the two
surviving `entry.js` processes belong to the user's dashboard (parent pid on
9119, started 16:46). The CI workflow edit cannot be verified locally; the
first push will show it.

Two things the browser taught that the unit layer could not:
1. Lyra sends the typed text to the model inside an `[[ IDRAK_INTERNAL_… ]]`
   directive block and appends runtime notes such as `[System: The active
   model for this chat has changed …]` as *user-role* messages after it. A
   naive "echo the last user message" echoed the note, and the reply never
   contained the typed text. The echo now skips `[System:` notes and keeps the
   tail of the block; the assertion looks for `Echo:` and the typed text in the
   same bubble rather than an exact string.
2. **Finding, deferred:** on every run the dashboard log shows
   `[tui_gateway] prompt.submit: history_version mismatch (expected=0
   current=1) — agent output NOT written to session history`. Cause read from
   the code: Studio pins provider/model at start-up through the model-switch
   path, whose `_append_model_switch_marker` appends a user-role note and bumps
   `history_version` while the hidden welcome-seed turn is in flight; the turn
   then refuses to write its messages. The welcome exchange is therefore
   missing from persisted history, and the marker lands mid-conversation in
   the model's prompt. Visible replies are unaffected. Follow the standing
   discipline: journey test reproducing the ordering → fix (either sequence
   the model pin before the seed turn or make the marker write turn-aware).

Compatibility / restart: none for users. Developers running the smoke locally
need `npx playwright install chromium` once and a built `ui-tui/dist/entry.js`
(`npm run build -w ui-tui`), and the `ultimate-builder` plugin enabled in the
sandbox config (the spec writes it).

Rollback / retained recovery data: revert the commit; the spec and config are
additive and CI's Electron job is unchanged apart from the new steps.

Local commit / authorized push: local commits `test(studio): Studio smoke in
Playwright` and `chore(release): bump Lyra to 0.19.45`; push follows the
standing release instruction.
