# Live chat feedback

The Hello session spent 208 seconds summarizing its conversation on September 5
at 23:10–23:14 BST, then resumed model and tool calls. Studio's activity card
replaced the summarizing label after 30 seconds even though the summarizing
heartbeat arrives every 60 seconds. Answer delivery also had no dedicated
confirmation event: Studio relied on tool/turn completion.

Acceptance: keep the actual operation visible between heartbeats, distinguish
sending an answer from waiting for one, confirm accepted answers by request ID,
and show current activity when sidebars are collapsed. Retain honest stale-update
feedback and manual stop/retry. Never fabricate model progress or resend answers
automatically. First accepted answer wins if a retry races with completion.

Affected surfaces: gateway blocking questions, dashboard question replay,
Studio question hook and activity presentation. No conversation content or
project files are migrated. Existing question transport remains compatible.

Verification: all 368 web tests and 102 gateway protocol/dashboard replay tests
passed. The web production build, TypeScript check, web lint and focused Python
lint passed. Timed UI tests cover the gap between summarizing heartbeats and
honest feedback when updates stop; protocol tests exercise a real blocking
question and prove confirmation happens before tool/turn completion. The real
dashboard broadcast/reconnect route does not replay an answered question.
These checks do not claim a complete upstream test-suite run or a live browser
inspection; computer-use permissions were unavailable. Source whitespace was
checked separately from generated JavaScript template strings.

Restart the backend and refresh Studio to activate the new confirmation event.
Existing tool completion remains a fallback for older backends. Rollback is a
revert of the implementation commit. Save locally; no push requested.
