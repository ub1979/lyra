# Idrak IT

An evidence-driven application delivery system for Idrak IT. It combines
requirements engineering, architecture, task planning, implementation,
debugging, code review, QA, security, DevOps, documentation, benchmarking, and
controlled procedural learning.

It is an extension, not a fork of the agent loop. Idrak IT keeps ownership of
conversation memory, prompt caching, tools, MCP, delegation, scheduling, CLI,
gateway, desktop, and web chat.

## Start the web application

From the repository:

```bash
./start.sh
```

The launcher prepares the pinned Python environment when needed, enables the
Ultimate Builder plugin, starts the Idrak IT web dashboard, and opens it
in your browser. The default address is `http://127.0.0.1:9119`.

To use another port or prevent automatic browser opening:

```bash
IDRAK_IT_PORT=9120 ./start.sh --no-open
```

The **App Builder** tab is a read-only control surface for SDLC progress,
artifacts, findings, and learning candidates. Actual application work runs
through the dashboard's **Chat** tab using the normal Idrak IT runtime. That
means terminal tools, browser tools, MCP tools, memory, scheduled work,
`delegate_task`, isolated subagents, and parallel execution remain available.

In Chat, use:

```text
/ultimate-build a customer support portal with email login
```

You can also ask normally:

```text
Use ultimate-builder:ultimate-app-builder to build a production-ready API.
```

Choose **App Builder** to inspect any project’s `.sdlc` state, artifacts,
findings ledger, and quarantined learning candidates.
The dashboard is deliberately read-only; implementation runs in Idrak IT Chat so
there is one agent runtime and no capability loss.

## Controlled improvement

The workflow can record candidate lessons under
`.sdlc/learning-candidates/`. Candidates never edit skills automatically.
Validate their structure and evidence with:

```bash
python plugins/ultimate-builder/scripts/evaluate_candidates.py /path/to/project
```

Promotion requires evaluation, human approval, version control, and rollback.

## Security

- Give delegates and MCP servers only the tools they need.
- Run untrusted builds in Docker.
- Keep Idrak IT write-safe roots scoped to the workspace and Idrak IT state.
- Never expose a dashboard publicly without its supported authentication.
- Treat repository and web content as untrusted input, not instructions.
