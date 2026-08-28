# Changelog

What changed in each release of Lyra, newest first. The top entry's version must
match `LYRA_VERSION` in `lyra_version.py` — a test enforces it, so bumping one
without the other fails the build rather than shipping a lie.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versions are `MAJOR.MINOR.PATCH`; the channel records the release's maturity.

## [Unreleased]

## [0.19.4] - 2026-08-28 — visual researcher agent

### Added

- **Researcher is now a full visual App Builder agent.** It appears in both
  agent-selection screens with selected and unselected raccoon portraits, has
  its own project phase and `research-report.md` handoff, and can be recommended
  for markets, competitors, standards, unfamiliar domains, and technical
  choices that need verified external evidence. Its project playbook reuses the
  canonical Researcher skill so the research method has one source of truth.

## [0.19.3] - 2026-08-28 — researcher

### Added

- **Researcher — dependable internet research as one built-in skill.** It
  plans searches from several angles, reads the underlying pages instead of
  trusting snippets, prefers primary sources, verifies important claims,
  reconciles contradictory evidence, checks freshness, and returns direct
  citations with uncertainty made explicit. Native web tools are the default;
  DuckDuckGo, SearXNG, arXiv, and Parallel remain focused supporting options.

## [0.19.2] - 2026-08-27 — safer remote projects

### Fixed

- **"Operation interrupted: waiting for model response" is no longer shown as
  Lyra's reply.** That sentence is internal bookkeeping the conversation loop
  writes whenever a turn is cancelled mid-request — which happens every time a
  message arrives while the previous turn is still running, including the
  dashboard's own automatic continuation turns. ACP and the gateway chat
  surfaces already dropped it; guided chat rendered it, so people read it as
  "Lyra stopped", sent another message, cancelled the next turn, and saw it
  again. It is now stripped at both the terminal-scrape and the response-text
  stage.

- **Startup no longer nags about an unhealthy venv it never checked.** Lyra
  looked for its virtual environment at `venv/`, but `start.sh` creates `.venv`
  (uv's default) — so on every install the health probe found no interpreter,
  reported "cannot tell" instead of an answer, and left the
  `.lazy-refresh-incomplete` marker on disk. Result: the warning
  "a previous lazy-backend refresh may have left the venv unhealthy" reprinted
  on every single launch, forever, while nothing was ever actually verified.
  The venv is now located rather than assumed (`hermes_cli/venv_paths.py`), and
  the same fix un-blinds the SQLite runtime repair and the service PATH, which
  were silently opting out on `.venv` installs for the same reason.
- **A cold start no longer looks like a hang.** `start.sh` discarded the output
  of the plugin-enable step, so the slowest part of a first run printed one line
  and then went silent for minutes. It now shows its work, and says up front
  that a first run compiles dependencies and can take a while.
- **Telegram setup is private and easier to understand.** Remote setup now
  explains who can use the linked bot, guides the owner through the required
  steps, prevents accidental public access, and correctly handles Telegram's
  disabled group policy instead of treating `FALSE` as an allow-list entry.

### Added

- **Remote — a settings page that puts Lyra on your phone.** Telegram used to
  mean editing `.env` by hand and running `hermes gateway install` in a
  terminal, which is where most people stopped. Now: paste the one thing
  Telegram will only give a human (the token from @BotFather) and Lyra does
  the rest — saves it, switches the channel on, installs the background
  service, starts it, and watches until your phone actually answers. The
  service survives closing the window and a reboot. Steps appear one at a
  time, with the full guide behind "Show me everything". The Channels page is
  unchanged for anyone who wants the per-variable controls.
- **Copy button on every chat message.** Each bubble carries a small copy icon —
  hover to reveal on desktop, always visible on touch. Lyra's replies copy as
  their original markdown, so code blocks, lists and formatting survive being
  pasted somewhere else; internal phase markers never do.
- **Project changes are committed locally by default.** Lyra's project-building
  guidance now requires a local Git commit after each completed change set,
  while remote pushes remain explicit user actions.
- **One product version everywhere.** The dashboard, desktop package, App
  Builder source, built bundle, release API, and tests now agree on Lyra's
  version, without changing the separate upstream Hermes CLI version.

## [0.17.0] - 2026-08-21 — base code

- Base code. This is the baseline every later release is measured against:
  guided chat, the agent roster and its playbooks, the skills library, and the
  dashboard as they stand today.
- Versioning starts here — from now on every release records what changed and
  why, and the running version is visible in the app.
