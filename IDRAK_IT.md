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

The browser opens on a friendly project launcher:

1. Choose **New project** or **Open project**.
2. Pick Full SDLC, MVP, Plan only, Review & QA, or one of your saved templates.
3. Select or clear individual skills.
4. Choose the project folder and describe what you want.
5. Select **Start conversation**.

The project then opens in a simple chat. The terminal rendering is hidden from
the user, while the normal Idrak IT runtime continues underneath it. Terminal
tools, browser tools, MCP tools, memory, scheduled work, `delegate_task`,
isolated subagents, and parallel execution therefore remain available.

Custom templates and recent projects are stored in that browser. A template can
be as small as requirements and architecture, or as broad as the complete SDLC.
Unselected phases are excluded from the workflow. In particular, **Plan only**
may inspect the project and write planning artifacts, but does not change
application code.

The original terminal-oriented Chat page remains available for advanced users,
but normal users do not need it.

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
