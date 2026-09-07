# Changelog

What changed in each release of Lyra, newest first. The top entry's version must
match `LYRA_VERSION` in `lyra_version.py` — a test enforces it, so bumping one
without the other fails the build rather than shipping a lie.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versions are `MAJOR.MINOR.PATCH`; the channel records the release's maturity.

## [Unreleased]

## [0.19.24] - 2026-09-07 — small visible development jobs

### Added

- **Development now follows the project's task graph as small saved jobs.**
  Each independently verifiable work item gets its own worker, dependency
  order, evidence, and local commit instead of one job attempting the whole
  remaining application.
- **Agent Activity names the exact part being built.** Running work and jobs
  needing attention remain visible with their task identifier and plain title.

### Fixed

- **An exhausted broad Development job no longer traps the project.** Lyra
  preserves its history, replaces it with bounded continuation jobs, and keeps
  later review work waiting for every required part.
- **Automatic job planning rejects blanket work such as “implement all
  remaining requirements.”** Lyra requests smaller jobs before saving them.
- **Worker limits are explained in plain language.** Studio says that progress
  was saved and a smaller continuation is needed instead of exposing `90/90`.

Restart Lyra after updating so the new scheduler and Studio activity view load.

## [0.19.23] - 2026-09-07 — compact truthful project status

### Added

- **Projects now have a small `.sdlc/status.json` snapshot.** Studio reads the
  validated snapshot for routine progress instead of repeatedly parsing or
  transmitting the growing Markdown history. Lyra rebuilds it atomically only
  when the detailed ledger changes.
- **Project Map shows its exact last-update date and time.** Active jobs also
  distinguish fresh, quiet, and stopped activity without hiding the worker or
  taking Lyra chat away.

### Fixed

- **Timer-generated waiting notices no longer impersonate real activity.** A
  provider that emits no output cannot keep resetting the worker heartbeat
  merely because Lyra explains that it is still waiting.
- **Long work no longer silently looks healthy forever.** After two minutes
  without a real update Studio says that it is waiting; after ten minutes it
  clearly offers recovery guidance while Lyra remains available for chat.

Restart Lyra after updating so the status projection and liveness fix load.

## [0.19.22] - 2026-09-07 — visible progress and message time

### Fixed

- **A busy chat stays visible after reconnecting.** Studio restores the live
  running state reported by Lyra and always offers Stop & retry while an
  ordinary turn is active.
- **Provider waiting notices no longer disguise a silent request as progress.**
  The explanation remains visible, but only real model output resets the
  bounded silence timer.
- **Project-agent work shows when it last reported activity.** Long background
  builds are distinguishable from jobs that have stopped reporting.

### Added

- **Every Studio message shows its local date and time.** New messages retain
  their timestamp in existing project-scoped browser storage, while older
  timestamped messages remain readable.

Restart Lyra after updating so both the backend and Studio load this fix.

## [0.19.21] - 2026-09-06 — consistent Studio model selection

### Fixed

- **Existing Studio chats now use the Main AI model selected in Settings.**
  Reconnecting or retrying no longer combines an old saved GLM model with
  Claude CLI. Both the model and provider are taken from the selected pair.
- **Saved-job model repair accepts the whole project team.** Requirements and
  other interactive specialists no longer cause the update to be rejected.
- **The active model label reflects the running conversation.** Reading Settings
  no longer changes the label before the conversation has actually switched.
- **A failed model switch stops before submitting to the old model.** The saved
  conversation remains available for retry after fixing the connection.

Restart Lyra after updating so both the backend and embedded chat load this fix.

## [0.19.20] - 2026-09-06 — portable AI connections

### Fixed

- **Claude Code now connects from its normal user installation.** Lyra finds
  Claude in trusted per-user install folders even when a desktop or background
  process started with a more limited PATH than Terminal.
- **Agent models no longer leak across AI providers or projects.** Model choices
  are saved per project and provider, always travel with their provider, and
  repair existing queued work when the project model changes.
- **Old Ollama assignments are cleared safely.** Choosing Claude Code or
  “Follow project model” can no longer retry Claude with an old GLM model id.

## [0.19.19] - 2026-09-06 — natural project decisions

### Changed

- **Questions now feel like part of the conversation.** Lyra asks once in its
  normal chat message, with answer choices and the custom-answer field directly
  below instead of repeating the question in a separate notice.
- **Approvals use the same natural pattern.** Approval choices sit beneath
  Lyra's message, while command details stay collapsed unless requested.
- **The Studio side panels now have separate jobs.** Agent Activity shows only
  agents working now; Project Map shows delivery phases and no longer repeats
  ad-hoc saved task titles.

## [0.19.18] - 2026-09-06 — private project histories

### Added

- **Every Lyra project now owns its local history.** Opening a project, starting
  `/ultimate-build`, or queuing saved project work creates or verifies a Git
  repository inside that project before an agent can make a commit.
- **Lyra protects its own releases from project files.** Local commit and push
  safeguards refuse generated project content, including an accidentally
  staged nested-project link.

### Fixed

- **Project commits can no longer move Lyra's `main` branch.** Project agents
  verify the exact project root before Git work and stop safely when an older
  project is still attached to Lyra's history.
- **Existing project work is preserved during setup.** Lyra's marker-only first
  commit does not sweep in staged, unstaged, or untracked files, and it never
  adds a remote or pushes without a separate user request.

## [0.19.17] - 2026-09-06 — reliable project handoffs

### Added

- **Saved project work stays visible.** Studio now shows durable agent activity,
  pending questions, and a clear “Review with Lyra” action even after a browser
  disconnect or when the side panels are collapsed.
- **Project history has stronger recovery support.** Verified progress, saved
  jobs, questions, and technical-review handoffs survive reloads and restarts.

### Fixed

- **Lyra no longer appears idle while project agents are working.** The agent
  list and project map use saved job state instead of guessing from chat text.
- **Question and review handoffs reach the correct conversation.** CLI-created
  and Studio-created jobs share the same notification policy, retry safely, and
  keep technical review separate from user approval.
- **Long waits are explained.** Active model and tool work now produces visible
  status, while stale project status is shown as unavailable instead of empty.

### Changed

- **Generated projects are excluded from Lyra releases.** The `my_projects`
  workspace remains local and is not tracked or published with the application.

## [0.19.16] - 2026-08-30 — durable project memory

### Added

- **Project Brain keeps large projects understandable across conversations.**
  Lyra stores a compact, project-local map of verified goals, architecture,
  durable decisions, risks, progress, evidence, and next actions. Every project
  agent reads and refreshes it with the same local commit as its work.
- **Project memory and history now live together in Studio.** Users can see
  whether Lyra's memory is current, return to automatic recovery points,
  continue saved project conversations, or branch safely in one modern panel.
- **Telegram remote control can isolate projects in dedicated topics.** Project
  handoffs preserve the matching conversation without mixing separate builds.

### Changed

- **Model replacement notices are clearer in light and dark modes.** Light mode
  now uses white and soft lavender surfaces with dark text instead of yellow
  text, while dark mode uses a muted indigo treatment.

### Security

- **Project Brain is bounded and evidence-based.** It stays under 16 KB,
  verifies material claims against project files, tests, and Git, and excludes
  credentials, personal data, raw conversations, copied source, and long logs.

## [0.19.15] - 2026-08-30 — unified Studio model experience

### Changed

- **AI settings and every model chooser now use Lyra Studio's visual language.**
  Provider setup, the main model chooser, Review Agent models, project models,
  and guided specialist choices now feel like one product instead of opening
  older Hermes-style panels.
- **Project popups now share the same modern dialog design.** Confirmations,
  sign-in, specialist selection, model setup, and related project actions use
  consistent rounded cards, spacing, controls, and light/dark styling.

### Fixed

- **Refreshing Ollama now shows the models that are actually installed.** Stale
  model entries are removed instead of surviving a refresh.
- **Projects moved to Trash now disappear from the projects screen.** Lyra no
  longer keeps showing shortcuts whose folders no longer exist.
- **Dialogs stay usable at narrow widths and larger text sizes.** Popup content
  wraps and scrolls without controls overlapping or being cut off.

## [0.19.14] - 2026-08-30 — modern Lyra Studio workspace

### Added

- **Lyra Studio now has a modern product-building workspace.** The projects
  home, guided setup, and project conversation use a calm visual system that
  keeps agents and terminal machinery behind the product experience.
- **Light and dark modes now follow one remembered Studio preference.** The
  compact theme control applies across projects, setup, chat, and project model
  settings.
- **Text can be set to Normal, Large, or Extra large.** The remembered
  readability setting increases both text and line spacing without zooming the
  interface or pushing panels beyond the window.
- **Agent Activity and Project Map sidebars can be collapsed independently.**
  Lyra remembers both choices and expands the central conversation into the
  space they release.

### Changed

- **Project controls now use compact circular icons.** Preview, remote control,
  theme, agents, workers, model settings, panel visibility, and navigation no
  longer appear as a row of Hermes-style rectangular buttons.
- **Telegram project handoff is now presented as Remote control.** The shorter
  label describes its purpose while setup guidance still explains the private
  Telegram connection.

### Fixed

- **Project Map text now wraps instead of being cut off or replaced with an
  ellipsis.** Cards, headings, and status labels stay inside the panel at larger
  text sizes and narrow widths.
- **Studio headers and controls now reflow before they overlap.** Setup and
  project toolbars compact cleanly across desktop and smaller windows.

## [0.19.13] - 2026-08-29 — safe project moving and Trash

### Added

- **Recent projects can now be moved, removed from Lyra, or sent to Lyra
  Trash.** Moving preserves the project's saved chat and background-job
  history; removing only hides the shortcut and never touches project files.
- **Project deletion is recoverable and clearly confirmed.** Lyra moves the
  entire folder into its own Trash instead of permanently erasing it, refuses
  to overwrite an existing destination, and will not move a project while an
  agent is actively working in it.

## [0.19.12] - 2026-08-29 — recoverable project agents

### Changed

- **Long project phases now run as saved background jobs.** Research,
  architecture, development, testing, and other non-interactive agents survive
  a closed or disconnected browser, use heartbeats and bounded retries, and
  recover unfinished work through Hermes' durable Kanban engine.
- **Saved project chats wake when a background agent finishes or needs help.**
  Lyra verifies the project record, explains the result in plain language, and
  continues only through the user's approved checkpoints.
- **The project map and worker controls now use real saved-job state.** Stale
  “working” ledger entries become an honest recovery warning; queued, running,
  blocked, paused, resumed, and completed work are no longer inferred from chat
  activity alone.
- **Starting Lyra also starts a recoverable local project worker when no
  messaging gateway is already available.** It is owned by the launcher and
  safely cleaned up with the application.

## [0.19.11] - 2026-08-29 — plain-language existing project chats

### Fixed

- **Saved project conversations now receive the non-technical communication
  rule on every turn.** Normal messages, retries, and automatic workflow
  continuation no longer depend on the instructions present when an older
  conversation was first created.

## [0.19.10] - 2026-08-29 — plain-language project updates

### Changed

- **Project updates now speak to non-technical users.** Lyra translates
  internal roadmap codes, change identifiers, schemas, migrations, filenames,
  and raw test evidence into what now works, what remains, and whether anything
  is blocked. Every progress update explicitly distinguishes a completed part
  from a completed application.

## [0.19.9] - 2026-08-29 — truthful project progress

### Fixed

- **The project map now reports durable, verified project state.** It reads the
  project's `.sdlc/progress.md` ledger, preserves its phase labels and statuses,
  refreshes while work continues, and no longer presents a guessed completion
  percentage based on browser-only chat markers.
- **Background agents can no longer replace the main project conversation.**
  Project recovery validates saved sessions, prefers the top-level project chat,
  and excludes delegated worker sessions from continuation resolution.

## [0.19.8] - 2026-08-29 — compression-aware project chat

### Fixed

- **Long context compression no longer looks like a failed AI response.**
  Guided project chat now recognizes the explicit compression lifecycle,
  displays a clear summarizing status, receives the backend's real 60-second
  compression heartbeat, and pauses the model-silence watchdog until normal
  turn activity resumes.

## [0.19.7] - 2026-08-29 — automatic project chat resume

### Fixed

- **A refreshed project chat resolves its saved conversation before starting
  an agent.** Direct `/chat` reloads now perform the same workspace migration
  as the Recent projects launcher, preventing a fresh temporary session from
  replacing a substantial existing conversation during recovery.

## [0.19.6] - 2026-08-29 — reliable project chat recovery

### Fixed

- **Existing projects can send messages after Lyra restarts.** Guided chat now
  accepts the agent session event as the authoritative ready signal, visibly
  explains a failed reconnection, and offers a one-click project-chat restart
  instead of leaving Enter and Send silently disabled.
- **Recent projects resume the same AI conversation.** Lyra records the durable
  session for each workspace and can migrate older projects by finding their
  matching saved conversation, so restored chat bubbles and agent context stay
  together.
- **Agent-team recommendations remain approval checkpoints.** A completed
  requirements phase no longer starts the next recommended agent before the
  user confirms the proposed team.

## [0.19.5] - 2026-08-28 — reliable long model waits

### Fixed

- **Long model turns no longer get falsely stopped after two minutes.** Guided
  chat now treats the backend's 30-second waiting heartbeat and streamed model
  reasoning as genuine activity. The live card explains that the provider is
  still working, and the silence watchdog remains available for requests that
  actually stop reporting.

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
