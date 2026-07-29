<p align="center">
  <img src="assets/banner.png" alt="Lyra" width="100%">
</p>

# Lyra

> **Describe it. Approve the design. Get a working app.**

Lyra is an AI agent that builds full-stack applications through conversation. It runs an autonomous SDLC pipeline — from requirements gathering to deployment — using 18 specialist agents that coordinate, learn, and improve with every project.

Built on [Hermes Agent](https://github.com/NousResearch/hermes-agent) by [Nous Research](https://nousresearch.com). MIT licensed.

<p align="center">
  <a href="#quick-start"><img src="https://img.shields.io/badge/Get_Started-5_min_setup-2ea44f?style=for-the-badge" alt="Get Started"></a>
  <a href="https://github.com/ub1979/lyra/blob/main/LICENSE"><img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" alt="License: MIT"></a>
  <a href="https://github.com/ub1979/lyra/discussions"><img src="https://img.shields.io/badge/Discussions-Ask_Anything-blue?style=for-the-badge" alt="Discussions"></a>
  <a href="CONTRIBUTING.md"><img src="https://img.shields.io/badge/PRs-Welcome-brightgreen?style=for-the-badge" alt="PRs Welcome"></a>
</p>

---

## What makes Lyra different

Most AI coding tools autocomplete lines or generate files. Lyra runs the entire software development lifecycle:

| What you do | What Lyra does |
|---|---|
| Describe your app in plain English | Interviews you for requirements, one question at a time |
| Approve a requirements summary | Generates a visual UI/UX preview for your approval |
| Say "looks good" | Architects, plans tasks, writes code, runs QA, deploys |
| Use your app | Learns from the session and gets better next time |

### The SDLC Pipeline

Lyra doesn't just write code — it runs a full software development lifecycle with 18 specialist agents:

```
You ──► Requirements ──► Architecture ──► Task Planning ──► Development
         Engineer         Architect        Planner          Developer
                                                              │
Deployed ◄── DevOps ◄── Security ◄── Code Review ◄── QA ◄────┘
              Engineer    Auditor      Reviewer       Engineer
```

Each specialist has deep domain knowledge. The coordinator (`idk_it`) orchestrates the pipeline, verifies each phase's output, and advances automatically — stopping only at approval checkpoints where your input matters.

### Self-Learning Loop

Lyra creates reusable skills from complex tasks and improves them during use. It remembers what worked across sessions, builds a model of your preferences, and gets faster and more accurate over time.

### Any LLM, Any Platform

Use whatever model fits your budget and needs:

| Provider | Models |
|---|---|
| **Nous Portal** | Hermes models |
| **OpenRouter** | Claude, GPT, Gemini, Llama, + hundreds more |
| **Google AI Studio** | Gemini 3 Flash/Pro |
| **Ollama** | Any local model (Llama, Qwen, Mistral, etc.) |
| **Fireworks AI** | Fast inference for open models |
| **+ 15 more** | Kimi, GLM, MiniMax, Arcee, DeepInfra, HuggingFace, Upstage... |

Switch providers with `hermes model` — no code changes, no lock-in.

Talk to Lyra from anywhere: **CLI** | **Web Dashboard** | **Desktop App** | **Telegram** | **Discord** | **Slack** | **WhatsApp** | **Signal** | **Teams** | **Google Chat** | **Email**

---

## Quick Start

### Install (Linux, macOS, WSL2)

```bash
curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash
source ~/.bashrc
hermes
```

### Install (Windows PowerShell)

```powershell
iex (irm https://hermes-agent.nousresearch.com/install.ps1)
```

### Set up a provider

```bash
hermes setup          # guided setup — picks a provider and model
# or manually:
hermes model          # switch models anytime
```

### Build your first app

Open the dashboard and click **New Project**:

```bash
hermes gateway        # starts the web dashboard at localhost:3000
```

Or from the CLI:

```bash
hermes
> Build me a todo app with categories and due dates
```

---

## Architecture

```
lyra/
├── agent/              # Core agent loop, tool execution, display
├── hermes_cli/         # CLI entry point, config, voice, gateway
├── tools/              # Built-in tools (terminal, browser, files, skills, memory)
├── plugins/
│   ├── ultimate-builder/   # Guided app builder with dashboard UI
│   ├── platforms/          # Telegram, Discord, Slack, WhatsApp, etc.
│   ├── image_gen/          # AI image generation
│   └── ...                 # 20+ plugins
├── skills/             # Built-in skill library
├── optional-skills/    # Community skills (blockchain, creative, data-science, etc.)
├── web/                # React dashboard (Vite + TypeScript)
├── apps/desktop/       # Electron desktop app
└── ui-tui/             # Terminal UI (Ink)
```

### Key Concepts

- **Specialist Agents**: 18 domain-specific agents (requirements, architecture, development, QA, security, DevOps, etc.) each with deep playbooks
- **SDLC Coordinator** (`idk_it`): Orchestrates specialists in sequence, verifies phase outputs, stops at approval gates
- **Guided Builder**: Dashboard plugin that turns the SDLC pipeline into a chat-driven experience with visual previews
- **Skill System**: Agents create, store, and improve reusable skills from experience
- **Terminal Backends**: Run commands locally, in Docker, via SSH, on Modal (serverless), Singularity, or Daytona
- **Memory**: Agent-curated persistent memory with FTS5 search and cross-session recall

---

## Run Anywhere

| Backend | Use Case |
|---|---|
| **Local** | Your machine, zero setup |
| **Docker** | Isolated container, reproducible |
| **SSH** | Remote server — agent can't read your `.env` |
| **Modal** | Serverless — hibernates when idle, near-zero cost |
| **Singularity** | HPC clusters |
| **Daytona** | Serverless dev environments |

```bash
hermes config set terminal.backend docker   # switch backend
```

---

## Dashboard

The web dashboard provides a clean, progressive-disclosure interface:

- **Guided Builder**: Chat-driven app creation with approval gates
- **Sessions**: View and continue conversations
- **Models**: Configure providers and switch models
- **Analytics**: Token usage and cost tracking
- **Plugins**: Enable/disable capabilities
- **Cron**: Schedule autonomous tasks in natural language

```bash
hermes gateway    # opens at localhost:3000
```

---

## Contributing

We welcome contributions! Please read our [Contributing Guide](CONTRIBUTING.md) before submitting a PR.

**Quick version:**

1. Fork the repo
2. Create a feature branch (`git checkout -b feat/my-feature`)
3. Make your changes
4. Run tests (`cd web && npm test`)
5. Submit a PR — all PRs require review before merge

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full process, coding standards, and what makes a good PR.

---

## Community

- [GitHub Discussions](https://github.com/ub1979/lyra/discussions) — questions, ideas, show & tell
- [Issues](https://github.com/ub1979/lyra/issues) — bug reports and feature requests

---

## Acknowledgments

Lyra is built on top of [Hermes Agent](https://github.com/NousResearch/hermes-agent) by [Nous Research](https://nousresearch.com). The upstream project provides the core agent framework, TUI, gateway, and tool system. Lyra adds the guided builder experience, progressive-disclosure dashboard, UI/UX improvements, and enhanced SDLC workflow.

---

## License

[MIT](LICENSE) — use it, modify it, ship it.
