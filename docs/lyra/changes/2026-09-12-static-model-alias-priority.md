Change / date: Static model alias provider priority / 2026-09-12
User problem and reproduction: The release verification suite found that the bare startup alias `sonnet` now selected the later-added `claude-cli` catalog under automatic provider selection, violating the existing native-provider contract and failing three model/gateway assertions. This is deterministic catalog-order behavior, not a credential failure.
In scope / explicitly deferred: Restore direct Anthropic priority for an automatic bare Claude alias while retaining Claude CLI when it is the currently selected provider. Do not change explicit provider selection, credentials, live model lookup, or runtime transport behavior.
Acceptance criteria: `sonnet` with provider `auto` resolves statically to Anthropic; `sonnet` with current provider `claude-cli` remains on Claude CLI; startup performs no network model detection.
Affected modules and data: `hermes_cli/models.py` and existing model/TUI gateway tests. No persisted data, credentials, or project files change.
Tests and observed results: The pre-change full TUI gateway file failed its two startup alias assertions because it returned `claude-cli`. After classifying the subscription transport behind the direct provider for automatic aliases, both gateway assertions and the new explicit-current-transport assertion passed. The combined 688-test release run completed with zero failures.
Compatibility / restart: Explicit Claude CLI users are unaffected. Running Lyra processes must restart to load Python changes.
Rollback / retained recovery data: Revert the focused commit; there is no migration or recovery data.
Local commit / authorized push: User previously authorized pushing Lyra modifications; included in the verified v0.19.36 release commit.
