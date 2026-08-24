# Changelog

What changed in each release of Lyra, newest first. The top entry's version must
match `LYRA_VERSION` in `lyra_version.py` — a test enforces it, so bumping one
without the other fails the build rather than shipping a lie.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versions are `MAJOR.MINOR.PATCH` on the `alpha` channel until the interface stops
moving under users.

## [Unreleased]

### Fixed

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

## [0.17.0] - 2026-08-21 — base code

- Base code. This is the baseline every later release is measured against:
  guided chat, the agent roster and its playbooks, the skills library, and the
  dashboard as they stand today.
- Versioning starts here — from now on every release records what changed and
  why, and the running version is visible in the app.
