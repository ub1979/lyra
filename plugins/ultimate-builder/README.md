# Ultimate Builder for Hermes Agent

An evidence-driven application delivery system for Hermes Agent. It combines
requirements engineering, architecture, task planning, implementation,
debugging, code review, QA, security, DevOps, documentation, benchmarking, and
controlled procedural learning.

It is an extension, not a fork of the agent loop. Hermes keeps ownership of
conversation memory, prompt caching, tools, MCP, delegation, scheduling, CLI,
gateway, desktop, and web chat.

## Install in this source checkout

This repository already contains the plugin under `plugins/ultimate-builder`.
Enable it:

```bash
hermes plugins enable ultimate-builder
```

Restart Hermes, then use:

```text
/ultimate-build a customer support portal with email login
```

You can also ask normally:

```text
Use ultimate-builder:ultimate-app-builder to build a production-ready API.
```

Open `hermes dashboard`, then choose **App Builder** to inspect any project’s
`.sdlc` state, artifacts, findings ledger, and quarantined learning candidates.
The dashboard is deliberately read-only; implementation runs in Hermes Chat so
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
- Keep Hermes write-safe roots scoped to the workspace and Hermes state.
- Never expose a dashboard publicly without its supported authentication.
- Treat repository and web content as untrusted input, not instructions.
