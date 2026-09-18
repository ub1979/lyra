Change / date: Provider-facing preflight context estimate, 2026-09-18
User problem and reproduction: The coordinator estimated 178,528 tokens before a request whose earlier provider input was 52,897; stored reasoning fields alone inflated reconstructed history from about 34,507 to 156,457 rough tokens. Compression delayed chat by 52 and 73 seconds.
In scope / explicitly deferred: Project only the provider-facing message fields for preflight/idle estimates, including ephemeral system and prefill content. Preserve stored history, provider echo and actual request construction. Wider compression policy is unchanged. The configured provider's 25% usage comparison awaits a live run.
Acceptance criteria: Custom GLM estimates ignore storage-only reasoning; providers requiring echo retain it; api_content, images, tools and system prompt remain counted. Representative estimates are compared with provider input usage and actual API message shape.
Affected modules and data: `agent/turn_context.py` and a focused projection helper; no persisted data migration.
Tests and observed results: 22 focused projection/context tests passed; Ruff clean. The configured provider's reported input tokens have not yet been compared with this estimate.
Compatibility / restart: Agent process restart required.
Rollback / retained recovery data: Revert helper and call sites; stored messages are untouched.
Local commit / authorized push: `fe183b24b`; not pushed.
