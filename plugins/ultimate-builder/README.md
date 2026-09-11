# Ultimate Builder for Lyra

An evidence-driven application delivery system for Lyra. It combines
requirements engineering, architecture, task planning, implementation,
debugging, code review, QA, security, DevOps, documentation, benchmarking, and
controlled procedural learning.

It is an extension, not a fork of the agent loop. Lyra keeps ownership of
conversation memory, prompt caching, tools, MCP, delegation, scheduling, CLI,
gateway, desktop, and web chat.

## Start the web application

From the repository:

```bash
./start.sh
```

The launcher prepares the pinned Python environment when needed, enables the
Ultimate Builder plugin, starts the Lyra web dashboard, and opens it
in your browser. The default address is `http://127.0.0.1:9119`.

To use another port or prevent automatic browser opening:

```bash
APPIT_PORT=9120 ./start.sh --no-open
```

The browser opens with **New project** and **Open project** choices. Users pick a
built-in or custom workflow template, toggle individual skills, choose a folder,
and start a normal conversation. Built-in templates cover Full SDLC, MVP, Plan
only, and Review & QA.

The guided conversation hides terminal rendering without replacing the agent
runtime. Terminal tools, browser tools, MCP tools, memory, scheduled work,
`delegate_task`, isolated subagents, and parallel execution remain available.
The selected project folder becomes the runtime working directory, and the
selected skill list constrains the workflow. A planning-only conversation does
not modify application code.

## Controlled improvement

The workflow can record candidate lessons under
`.sdlc/learning-candidates/`. Candidates never edit skills automatically.
Validate their structure and evidence with:

```bash
python plugins/ultimate-builder/scripts/evaluate_candidates.py /path/to/project
```

Promotion requires evaluation, human approval, version control, and rollback.

## Workflow contract and project memory

Run `hermes project-run contract` to inspect the declared enforced versus
model-guided workflow rules and validate their evidence paths and native tool
names. Project runs use `.sdlc/learnings.jsonl` as the canonical learning view;
legacy debugging lessons are imported once without deleting their source file.

For a tiny spelling-only correction, run
`hermes project-run classify-change --workspace /path/to/project`. Only a
positive mechanical result permits skipping the change record. Verification,
class-map maintenance and a local commit still apply.

## Security

- Give delegates and MCP servers only the tools they need.
- Run untrusted builds in Docker.
- Keep Lyra write-safe roots scoped to the workspace and Lyra state.
- Never expose a dashboard publicly without its supported authentication.
- Treat repository and web content as untrusted input, not instructions.
