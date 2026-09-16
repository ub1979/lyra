# Turn history persists, and a lost reply is announced — 2026-09-16

Change / date: a Studio turn that adopts the configured model no longer
invalidates its own history write, and the gateway's "shown but not saved"
warning is rendered in Studio; 16 September 2026 (late, after the user's
independent review ranked history persistence as the top remaining defect).

User problem and reproduction: the Studio Playwright smoke (0.19.45) logged
`[tui_gateway] prompt.submit: history_version mismatch (expected=0 current=1)
— agent output NOT written to session history` on every run, for the hidden
welcome turn. The user also reproduced that Studio ignores the backend's
warning. Cause, now proven by a journey test rather than read from the code:
`_run_prompt_submit` snapshots `history_version` before starting the turn
thread; inside the thread, `_sync_agent_model_with_config` runs for Studio's
coordinator on every turn and, when it adopts the configured model, calls
`_apply_model_switch` → `_append_model_switch_marker`, which appends a
`[System: The active model … changed]` user-role note and bumps
`history_version`. The turn then finds `current != expected` and refuses to
write `result["messages"]`. After the welcome turn, `session["history"]` held
only the note (the journey's failing assertion showed exactly that list). The
earlier hypothesis blamed the Studio model pin at session creation; the
mechanism is the per-turn config sync — same marker, different caller.

In scope / explicitly deferred:
- `tui_gateway/server.py`: after the config sync inside the turn thread, the
  baseline `history_version` is re-read under `history_lock` (two lines plus
  a `nonlocal`), so the note becomes part of the history the turn extends.
  The result written back includes both the note and the reply. Nothing else
  in the turn changes; the external-edit guard still fires for real external
  changes.
- Journey `tests/tui_gateway/test_studio_turn_history_persists.py` (real
  `_run_prompt_submit`, real marker, real poller-free turn; the provider-facing
  `_apply_model_switch` is replaced by a stand-in that performs exactly its
  two side effects): (1) first-turn adoption keeps the reply and the note,
  adopts once, and a second turn adds no second note; (2) an external
  history rewrite mid-turn still yields the reply on `message.complete` with
  the `warning` field — captured as `tests/fixtures/studio_frames/
  reply-not-saved.jsonl`.
- Web: new `web/src/lib/guided-reply-warning.ts` (one function) turns
  `payload.warning` into a `plain`, `tone: "warning"` line keyed by turn;
  the reducer appends it once after the reply (`appendMessageOnce`);
  `GuidedMergeMessage` gains `tone?: "warning"`; `ChatPage` styles that tone
  amber. Tests: unit (`guided-reply-warning.test.ts`), reducer (two cases:
  once per turn; a later reply lands after it), real-frame replay of
  `reply-not-saved`.
- Deferred: why the adoption fires on a session already built with the
  configured model (the smoke's sandbox) — a redundant switch and note on
  the first turn. Harmless now that the reply is kept, but it should be a
  no-op; separate change. Feedback-latency visibility (120 s usage-snapshot
  throttle, job poll interval) — next.

Acceptance criteria: journey (1) fails on the previous gateway (it did: the
history contained only the note) and passes after the fix; journey (2)
produces the warning frame; gateway suites unaffected; web check green with
the new frame replayed; Studio smoke passes against the rebuilt bundle with
no `history_version mismatch` in the dashboard log.

Affected modules and data: `tui_gateway/server.py`, `web/src/lib/
guided-reply-warning.ts` (+test), `guided-event-reducer.ts` (+tests),
`guided-response-merge.ts` (type), `guided-event-reducer.frames.test.ts`,
`web/src/pages/ChatPage.tsx` (one className), rebuilt `hermes_cli/web_dist`,
`tests/fixtures/studio_frames/reply-not-saved.jsonl`, `docs/lyra/CODE_MAP.md`.
Stored data: sessions opened from now on keep their first exchange; nothing
is migrated for earlier sessions (their welcome exchange was never written).

Tests and observed results: `scripts/run_tests.sh
tests/tui_gateway/test_studio_turn_history_persists.py
tests/tui_gateway/test_lyra_project_workflow.py
tests/tui_gateway/test_notification_busy_state.py
tests/tui_gateway/test_studio_model_routing.py -q` — 17 passed (the new
file's first test failed before the fix with the history `[note]` only);
fixture drift check passes without the write flag; ruff clean.
`npm --prefix web run check` — 58 files, 459 tests, 0 lint errors. Studio
smoke against the rebuilt bundle: passed in 9.0 s and the captured dashboard
stderr is empty — before this change the same capture held one
`history_version mismatch` line on every run (0.19.45 record).

Compatibility / restart: restart Lyra and reload Studio once.

Rollback / retained recovery data: revert the commit. The frame fixture
stays valid for the reducer regardless.

Local commit / authorized push: local commits `fix(gateway): a turn that
adopts the configured model keeps its reply`, `feat(studio): show the
gateway's "not saved" warning under the reply` and `chore(release): bump
Lyra to 0.19.49`; pushed under the standing release instruction.
