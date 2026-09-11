# Guided diff leak — 2026-09-11

Change / date: Keep internal patch output out of Lyra's guided conversation,
2026-09-11.

User problem and reproduction: After approving requirements in a guided
project conversation, the main chat displayed the patch tool's raw multi-file
diff (absolute paths, unified-diff markers, and project-state edits) as though
it were Lyra's reply. The canonical saved session contains the patch as a tool
result and a separate plain-language assistant reply, proving the model did not
return the diff. The browser terminal fallback could temporarily become
authoritative when the structured event socket disconnected, and its parser
could reuse an older `Response` marker even after a newer tool/diff block had
started.

The same live reproduction exposed a second recovery failure: opening the
saved project in a fresh browser showed an empty main conversation even though
the canonical session contained Lyra's pending design-approval question.
Guided messages were restored only from browser local storage, so a reconnect
on another browser profile could make a healthy saved session look stalled.

In scope / explicitly deferred: Fence the guided terminal fallback after the
structured feed has connected once, and reject stale response boundaries when
newer tool or diff activity follows them. Preserve the terminal's developer
diff display outside guided Studio and preserve the fallback for older
backends that never establish the structured feed. When local browser history
is empty, recover the latest trustworthy conversational tail from the
canonical saved session while excluding tools and synthetic routing/job
messages. If browser history exists but missed a later saved reply, append
that reply once without replacing the richer local transcript. Do not alter
the generated song project or its saved conversation.

Acceptance criteria: A transient structured-feed disconnect cannot promote
terminal text into a guided assistant message; a transcript containing an old
response followed by a wrapped multi-file patch remains working activity; a
new response after that patch is still presented normally; existing guided
chat behavior and the web build pass. A fresh browser resuming a saved session
shows Lyra's latest real reply, never a tool result or internal notification.

Affected modules and data: Guided chat output parsing, saved-session recovery,
the session message API type, and the Studio chat page. Session history is read
through the existing authenticated API; no persistent-data or
security-boundary changes.

Tests and observed results: The focused parser regression first failed by
classifying the reproduced transcript as a response, then passed after the
fix. All 402 web tests passed, including structured-feed authority, canonical
session recovery, stale-browser merge, and internal-message filtering;
TypeScript type-checking passed, the full web lint completed with no errors
(31 pre-existing warnings), and the production dashboard build passed. A live
reload of the affected saved project restored Lyra's pending approval question
in the main chat with no patch output. The file-map generator also exposed
unrelated untracked user files; the maintained-file entries for this change
were updated without adding those files to the map.

Compatibility / restart: Existing sessions remain compatible. The dashboard
frontend must be rebuilt and the local dashboard restarted to load the fix.

Rollback / retained recovery data: Revert the focused commit. Saved project
files, jobs, and conversation history are untouched.

Local commit / authorized push: Implementation commit `06c439f85`. The user
authorized the release push on 2026-09-11; release metadata is synchronized as
Lyra 0.19.32 in the following release commit.
