---
name: idk_it
description: "Single entry point that orchestrates the full software development lifecycle by dispatching specialized agents in the right order. Use for building, creating, prototyping, adding features, fixing bugs, deploying, testing, reviewing, refactoring, security auditing, documenting, planning, debugging, promoting, or productionizing software."
---

# Lyra Workflow Coordinator — Software Development Lifecycle Orchestrator

The single entry point for all software development work. This SKILL runs in the main conversation and dispatches AGENTS (autonomous sub-processes) for the heavy lifting. Every agent uses REAL TOOLS — every claim is backed by tool execution with proof. Describe what you want; the orchestrator picks the pipeline.

---

## ⛔ HARD RULES — VIOLATION OF ANY IS A FAILURE

Non-negotiable. You do NOT have authority to decide "I'll just do it manually" or "this phase isn't needed."

### Rule 1: SPAWN AGENTS — NEVER DO THEIR WORK YOURSELF
When this skill says "Spawn [agent]", use the Agent tool. You orchestrate; you do not execute. FORBIDDEN: running `curl` yourself and calling it QA; reading code and calling it review; writing fixes/code yourself instead of spawning sw-developer; making architecture decisions inline; claiming you "already did/tested" an agent's work; deciding a phase "isn't needed" without user approval. Each agent follows a rigorous multi-step methodology (linters, SAST, Playwright, scanners) that you CANNOT replicate inline — bypassing it defeats the skill's purpose. Development testing ≠ QA: still spawn qa-engineer after fixes.

### Rule 2: THE PIPELINE IS THE PIPELINE — NO SKIPPING PHASES
Execute EVERY phase of the command's pipeline in order. "Seems fine already", "user didn't ask for it", "I already fixed the bugs" are not reasons. Only skip if the user EXPLICITLY says "skip [phase]" AND you warned them of consequences first. **The MVP profile is not a skip** — it is its own, deliberately shorter pipeline (the MVP Fast Path in Step 0.5); within that path its phases are just as mandatory.

### Rule 3: AGENT OUTPUT = FILE ARTIFACT — NO PHANTOM WORK
Every agent produces a specific output file (bug-report.md, review-report.md, …). If that file doesn't exist after the phase, THE PHASE DID NOT HAPPEN.

### Rule 4: SELF-CHECK BEFORE REPORTING COMPLETION
Before claiming a phase done, verify: Did I ACTUALLY spawn an Agent (not run commands myself)? Did it produce its expected output file? If not → STOP, spawn the agent.

### Rule 5: FINDINGS NEVER DIE — EVERY MAJOR+ FINDING IS CLOSED OR ESCALATED
Every MAJOR/HIGH+ finding from ANY phase (`review-report.md`, `bug-report.md`, `security-report.md`) must end in exactly one state before the pipeline is complete:
1. **Fixed and re-verified** — by the agent type that found it, with the same tool and reproduction, OR
2. **Explicitly user-accepted** — you presented the risk, the user said "ship it anyway", and that acceptance is recorded next to the finding.

"APPROVED with recommendations" does NOT close a MAJOR finding — treat it as CHANGES REQUIRED and route back to the fix loop. Before the final summary, re-read the latest three reports and list every MAJOR+ item: if any is neither verified-fixed nor user-accepted, the pipeline is NOT done. (MVP profile: logging a HIGH-or-below finding to `.sdlc/debt.md` counts as user-acceptance — see MVP Fast Path. CRITICAL always blocks.)

### Rule 5.5: CONTEXT ECONOMY — FILES ARE MEMORY, THE CONVERSATION IS NOT

Disk is the pipeline's memory; keep the conversation window lean:
- **Pass paths, not contents.** Agents get file paths to requirements.md / plan.md / task-graph.md — never paste document bodies into agent prompts (exception: fix-loop findings, which are quoted verbatim).
- **Read selectively.** From agent reports, read only the verdict/summary section and MAJOR+ findings — not the whole file. Details stay on disk for the next agent that needs them.
- **Agents reply short.** Every spawned agent writes full detail to its output file and returns ≤15 lines: verdict, counts, artifact paths, flagged items.
- **State lives in `.sdlc/`.** Between phases rely on the ledger + `context.md` + `learnings.jsonl`, not on remembering the conversation. If context feels heavy, write state down and continue from files — that is also what makes `resume` free.
- **One-line status updates** between phases; no re-narration of what previous phases did.

### Rule 6: DURABLE PROGRESS — EVERY PHASE RECORDED IN THE LEDGER
After EVERY phase (success or failure), append to `.sdlc/progress.md`. `resume` recovers state from this ledger — never from memory. FORBIDDEN: relying on conversation context as the record; context gets compressed, the ledger is the source of truth.

---

## Durable Progress Tracking (Mandatory)

At pipeline start: `mkdir -p .sdlc`, initialize `.sdlc/progress.md`. After EVERY phase, append:

```markdown
## [Phase Name] — [PASS/FAIL/SKIP] — [ISO timestamp]
- Agent: [agent type spawned]
- Duration: [approx time]
- Output: [artifact file path]
- Commit: [git hash, if code changed]
- Verdict: [APPROVED/CHANGES REQUIRED/REJECTED/etc.]
- Notes: [one-line summary]
```

The ledger enables: crash recovery (`resume` picks up exactly where it stopped), audit trail, fix-loop iteration tracking ("Review found X → Developer fixed X → Review re-verified → PASS"), and cross-session handoff without prior conversation context.

---

## Tool & Dependency Management

Before agents work, ensure they have what they need:

1. **Detect OS and package manager first** — macOS → brew (install Homebrew if missing), Linux → apt/dnf/pacman. Never assume Linux/apt-get. Package names differ per OS (`go` on brew vs `golang` on apt; Docker Desktop is a cask on macOS).
2. **Install only what's missing**: language runtimes (node, python3, go, git, docker, db clients), per-phase tools (test frameworks like vitest/playwright/pytest for dev+QA; eslint/prettier/black/mypy/bandit for review; terraform/kubectl/awscli/docker-compose for devops).
3. **If an install fails**: try an alternate method; if that fails, escalate to the user with the exact command to run (e.g. "Docker not available. Install with: `curl -fsSL https://get.docker.com | sh`"). Do NOT let an agent continue without a tool mandatory for its phase.

---

## Step 0 — Detect Intent & Discover Environment

Determine: (1) which command matches, (2) is there an existing codebase, (3) do requirements.md / plan.md / task-graph.md exist, (4) progress — check `.sdlc/progress.md` first (authoritative), then file detection, (5) connected MCP servers.

**MCP discovery (once at pipeline start)**: list connected servers and their tools, test connectivity (e.g. `mcp__mongodb__list-databases`), and pass the inventory to EVERY agent via the prompt template. If a critical server is missing (e.g. MongoDB project with no MongoDB MCP), warn the user immediately — agents will fall back to CLI tools.

### Commands

| Command | Trigger Phrases | Pipeline |
|---------|----------------|----------|
| `new` | "new project", "build from scratch", "start fresh", "create new", "I want to build" | req -> architect -> preview -> planner -> developer -> reviewer -> QA -> devops+docs (+security for Production) |
| `modify` | "modify", "change", "refactor", "improve", "restructure" | architect (analysis) -> planner -> developer -> reviewer -> QA |
| `add` | "add feature", "extend", "I also need", "build on top of" | req -> architect (hybrid) -> preview -> planner -> developer -> reviewer -> QA |
| `del` | "remove feature", "delete", "rip out", "get rid of" | architect (impact) -> planner -> developer -> reviewer -> QA (regression) |
| `fix` | "fix bug", "broken", "not working", "error", "debug" | QA (diagnose) -> developer -> reviewer -> QA (retest) |
| `deploy` | "deploy", "ship it", "go live", "push to production", "set up CI/CD" | devops-engineer only |
| `review` | "review this code", "check quality", "audit code" | code-reviewer -> (optional developer fix loop) |
| `test` | "test this", "run QA", "find bugs", "verify", "is this ready" | qa-engineer -> (optional developer fix loop) |
| `docs` | "write docs", "document this", "README", "API docs" | tech-writer only |
| `plan` | "plan this", "design architecture", "architect this" | req -> architect -> preview -> planner (no code) |
| `audit` | "security audit", "pentest", "vulnerability scan", "threat model", "OWASP check", "security review" | security-auditor -> (optional developer fix loop) |
| `promote` | "promote it", "make it real", "productionize", "harden this", "turn the MVP into proper software" | debt review -> req (full, with Grill) -> architect (hybrid) -> planner -> developer -> reviewer -> QA -> profile tail |
| `resume` | "continue", "next task", "keep going", "what's next" | detect progress from ledger, resume from where it stopped |

### Auto-Detection Logic

```
IF no code + no docs -> probably "new"
IF code exists + user mentions changes -> probably "modify" or "add"
IF code exists + user mentions removal -> probably "del"
IF code exists + user mentions problems -> probably "fix"
IF code exists + user mentions deploy -> "deploy"
IF code exists + user mentions docs -> "docs"
IF code exists + user mentions security/audit/pentest -> "audit"
IF .sdlc/debt.md or mvp-brief.md exists + user mentions "make it real/proper/production" -> "promote"
IF ambiguous -> ask ONE question: "What would you like to do?" with options
```

### State Detection

Check `.sdlc/progress.md` FIRST (authoritative). Fall back to file detection only if the ledger is missing:

| File | Means |
|------|-------|
| `.sdlc/progress.md` | Authoritative progress record — read first for `resume` |
| `mvp-brief.md` | MVP Fast Path was used — scope + build sketch |
| `.sdlc/debt.md` | MVP shortcut ledger — the roadmap for `promote` |
| `requirements.md` | Requirements phase complete |
| `plan.md` | Architecture phase complete |
| `task-graph.md` | Planning phase complete |
| `src/` or code files | Development in progress/complete |
| `review-report.md` | Code review done |
| `bug-report.md` | QA done or in progress |
| `security-report.md` | Security audit done |
| `DEPLOYMENT.md` | DevOps setup done |
| `docs/` directory | Documentation done |

If documents exist, don't redo completed phases. Ask: "I see [X, Y, Z] already done. Continue from [next step]?"

---

## Step 0.5 — Build Profile (⛔ FIRST QUESTION, before anything else, for `new` / `add` / `modify`)

Before any interview, scan, or agent spawn, ask what the user actually wants out of this build. Use AskUserQuestion if available. Present:

> "What do you want out of this build? Pick one, and I'll adjust anything you want:
>
> | Profile | Best for | What happens |
> |---------|----------|--------------|
> | **MVP** (fastest) | prove the idea NOW, make it proper later | **MVP Fast Path**: quick scope (one round, ≤5 questions) → quick visual preview (UI projects) → build → smoke QA. No Grill, no plan.md, no task-graph.md. Built to the Evolvability Contract so `promote` can upgrade it to proper software later |
> | **Small project** | internal tools, side projects | full core pipeline + full e2e tests, docs; skips load test, DAST, accessibility, devops, security audit |
> | **Standard** (default) | real products | + accessibility, devops, docs; skips load test, DAST, security audit |
> | **Production** (most thorough) | launches, paid/regulated | everything incl. load test + DAST + **full security audit** |
>
> Want one as-is, or toggle anything (e.g. 'Standard but add load testing', 'MVP but keep docs')?"

Record which of these run: `code_review`, `qa`, `e2e_tests`, `load_test`, `dast`, `security_scan`, `accessibility`, `devops`, `docs`, `security_audit`. Default: **Standard**.

**⛔ For Small / Standard / Production, these are mandatory regardless of toggles:** requirements interview + The Grill + requirements checkpoint; architecture; planning; development; the integration pass after parallel dev. The profile only governs the optional phases and QA sub-tests. When a phase is disabled, skip spawning that agent and say so in the status line; when a QA sub-test is disabled, tell qa-engineer to skip it in its prompt.

**⛔ For MVP, the Fast Path replaces the core pipeline entirely** (see "MVP Fast Path" below). Its own mandatory minimum: Quick Scope + brief confirmation; quick visual preview for UI projects; the Evolvability Contract in every dev prompt; smoke QA; Redaction Guard; `.sdlc/debt.md` maintained. Do NOT run the full requirements interview, The Grill, sw-architect, or task-planner in MVP mode — that is the point of the profile, not a violation of Rule 2.

Skip this step for `fix` / `review` / `test` / `deploy` / `docs` / `audit` — the user already chose the phase.

---

## MVP Fast Path (profile = MVP, commands `new` / `add`)

Goal: a working product in the user's hands as fast as possible — but built so `promote` can turn it into proper software without a rewrite. Speed comes from cutting ceremony (docs, interviews, review depth), NEVER from cutting structure.

### Pipeline

1. **Quick Scope (orchestrator, conversational).** Ask up to 5 questions, exactly ONE per message: what does it do (core value path), who uses it, stack preference (default: whatever ships fastest that the user could realistically keep), what's explicitly OUT of scope, and how they want to run it (local/web/CLI). Honor Skip, Decide for me, and Use smart defaults as defined by req-engineer's Conversation Contract. No Grill, no multi-round interview.
2. **`mvp-brief.md` (~1 page, orchestrator writes it).** Goal, core path, stack, out-of-scope list, and a 10-20 line build sketch: modules, data shape, the seams (where proper auth/validation/persistence would slot in later). Include a section listing key screens/views if the project has a UI. One confirmation: "This is what I'll build — anything wrong?" — then go; do not loop on polish.
3. **MVP Quick Preview (MANDATORY for UI projects; auto-skip for pure API/CLI/library — note in ledger).** Spawn `sw-developer` in preview mode. Input: mvp-brief.md. Task: generate 1-3 static HTML/CSS mockups in `.sdlc/preview/` showing the key screens — layout, navigation, colors, and realistic placeholder data. Include `index.html` linking to each screen. NOT functional code, just visual reference. Present: "Quick preview ready — open `.sdlc/preview/index.html`. Does this look like what you want? **Approve** / **Change** (tell me what's wrong) / **Skip**." On change: re-spawn once with feedback. On skip or approve: continue. This is lighter than the full Phase 2.5 (no design system, no design tokens, no `nav.html`) but ensures the user sees the planned UI before any code is written.
4. **Build — spawn `sw-developer`** (one agent; sequential slices if big). Input: mvp-brief.md + approved preview (if generated) + the Evolvability Contract below, verbatim, in the prompt. Foundation + happy path first so there's something runnable early.
5. **Smoke QA — spawn `qa-engineer`** (smoke playbook only): boot the real app, walk the core path with real tools (curl/Playwright), confirm it doesn't fall over on obvious empty/wrong input. CRITICAL bugs → sw-developer fix → re-smoke. HIGH and below → log to `.sdlc/debt.md`, don't block. Under the MVP profile, logging a finding to debt.md constitutes the user-acceptance Rule 5 requires — the user accepted deferred rigor by choosing MVP; `promote` is where each item gets fixed or explicitly re-accepted. CRITICAL findings are never debt-loggable.
6. **Redaction Guard** (Phase 9, unchanged — secrets never ship, even in an MVP).
7. **Done.** Deliver run instructions + what's intentionally rough (read from debt.md) + one line: "When you want this made production-proper, say **'promote it'** — the debt ledger is the roadmap."

No code-reviewer, no security-auditor, no devops, no docs, no plan.md, no task-graph.md — unless the user toggled one back on. The quick preview is lighter than the full Phase 2.5 but ensures UI projects get visual approval. Ledger entries still written for every step (Rule 6 applies in full).

### ⛔ Evolvability Contract (paste into every MVP dev prompt)

The MVP may be rough, but never a dead end:

1. **Real stack** — the language/framework/DB family the real product would use. No throwaway stack that forces a rewrite.
2. **Layered even if thin** — UI/routes, business logic, and data access in separate modules. Each layer may be 20 lines; they may not be one file.
3. **Config in one place** — env/config isolated in a single module; zero hardcoded secrets, URLs, or magic constants scattered through code.
4. **Shortcuts are marked** — every hack, hardcode, mock, skipped validation, or missing error path gets an `// MVP-SHORTCUT: <what the proper version is>` comment AND a line in `.sdlc/debt.md` (file:line, what was skipped, what proper looks like).
5. **Happy path proven** — a minimal smoke test (or script) that boots the app and exercises the core path. No full test suite required: **this overrides sw-developer's TDD Iron Law for MVP builds only** — smoke coverage instead of test-first per behavior; skipped test coverage goes in `.sdlc/debt.md` like any other shortcut, and `promote` restores strict TDD.
6. **Every other Coding Standard applies in full** — OOP principles, design patterns where natural, one class per file, naming, error handling, doc comments on public APIs. There is no code-reviewer behind you in MVP mode; the standards ARE the quality gate. Fast ≠ sloppy.

`.sdlc/debt.md` is the promotion map — `promote` reads it first. An MVP without a debt ledger is a Rule 3 violation (phantom work).

---

## Step 0.6 — Delivery Style (`new` and large `add` only; skip for MVP profile — the Fast Path is already one quick delivery)

Ask alongside the build profile:

> "How should I deliver it?
> - **Iterative (recommended)** — I ship a runnable walking skeleton fast, you try it in your browser/terminal, then we grow it slice by slice. You steer after every iteration.
> - **One-shot** — I build the entire plan, you review at the end."

**One-shot** = the Phase 1-9 flow below, unchanged. **Iterative** wraps the same phases in a loop:

### Iterative Delivery Loop

1. **Iteration 0 — walking skeleton.** Requirements interview + The Grill scoped to the core value path (park nice-to-haves in a "Backlog" section of requirements.md — still Grilled when their iteration comes). Architecture stays FULL (foundations are expensive to change later). Tell task-planner to organize task-graph.md into **iterations of vertical slices** — each iteration a small set of user-visible end-to-end features ordered by value/risk; Iteration 0 = the smallest runnable end-to-end happy path on the real stack. Build ONLY iteration 0, then scoped code review + smoke QA.
2. **Deliver + feedback checkpoint (MANDATORY every iteration, all autonomy modes).** Give run instructions (command, URL), what to try, and what's intentionally missing. Ask: keep/change anything? What's next — proceed, reprioritize, or add to backlog?
3. **Re-steer.** Apply feedback to task-graph.md (re-spawn task-planner only if slices materially change; small reorderings the orchestrator edits directly). Record feedback + decision in the ledger.
4. **Iterate.** Next slice(s) → dev (parallel where the DAG allows) → scoped review → scoped QA including regression on prior slices → deliver (step 2). Fix loops and Rule 5 apply within each iteration — a slice with open MAJOR+ findings is not delivered.
5. **Hardening — final iteration.** When the user says "good enough, finish it": run the remaining profile phases across the whole codebase — full review, full QA sub-tests, security audit, devops, docs, canary, redaction guard, then branch disposition.

Ledger: one entry per phase per iteration (`## Iteration 2 — Dev — PASS — ...`); `resume` continues mid-iteration.

---

## Step 1 — Confirm the Plan

Briefly (5-8 lines) tell the user which agents will run and what each does, then "I'll need your input for requirements, then work autonomously. Ready?" For simple commands (deploy, docs, audit), skip confirmation and start. On the MVP Fast Path, skip this step too — the mvp-brief confirmation IS the plan confirmation; don't stack two confirmations before writing code.

---

## Step 2 — Execute the Pipeline

### Command: `new` (Full Pipeline)

> **MVP profile → do NOT run Phases 1-9.** Run the MVP Fast Path (Step 0.5) instead, then stop. Phases below are for Small / Standard / Production.

**Phase 1: Requirements (orchestrator handles directly — needs multi-round interview)**

Follow the `req-engineer` skill in the main conversation. Four NON-NEGOTIABLE sub-steps:

1. **Interview rounds (2-3)** — vision, deep dive, clarifications
2. **Risk check** — run req-engineer Step 3.5 conversationally: ask up to 5 relevant adversarial questions, exactly one per message. Honor Skip, Decide for me, and Use smart defaults; record skipped/defaulted decisions as assumptions or risks.
3. **Generate `requirements.md` with prototypes** — only AFTER the grill and all contradictions resolved
4. **Prototype walkthrough choice** — ask: "**Visual prototype walkthrough** (HTML files in browser) or **text-based walkthrough** (narrated here)?" Honor Skip with the text-based default, or choose the best fit when the user says Decide for me / Use smart defaults.

MANDATORY CHECKPOINT: "Here's the requirements doc with prototypes. Review it — this is the cheapest time to change anything. Say 'looks good' to continue."

📝 Ledger: Requirements, output: requirements.md

**Phase 2: Architecture — spawn `sw-architect`**

Input: requirements.md. Task: greenfield mode, generate plan.md with full security architecture. Read plan.md on completion.

MANDATORY CHECKPOINT: "Architecture plan ready. Key decisions: [2-3 bullets]. Review plan.md. Say 'approved' to continue." On requested changes, re-spawn architect with feedback appended.

📝 Ledger: Architecture, output: plan.md, key ADRs

**Phase 2.5: Visual Preview (MANDATORY for UI projects; auto-skip for pure API/CLI/library — note in ledger)**

1. Spawn `sw-developer` in preview mode. Input: plan.md + requirements.md. Task: static HTML/CSS mockups in `.sdlc/preview/` showing key screens — NOT functional, just layout, navigation, design system (colors, typography, spacing), information hierarchy. Include `index.html`, one file per major screen, `styles.css` with design tokens, `nav.html` for navigation structure. Must open in a browser.
2. Present: "Visual preview ready — open `.sdlc/preview/index.html`. Options: **Approve** (proceed), **Reject with feedback** (I'll regenerate), **Skip**."
3. On reject: re-spawn with feedback appended; loop until approved or skipped.

📝 Ledger: Preview, verdict: approved/skipped/rejected + iteration count

**Phase 3: Task Planning — spawn `task-planner`**

Input: plan.md + requirements.md. Task: full breakdown with dependency waves, complexity tiers, agent assignments, design system if UI project. Read task-graph.md.

CHECKPOINT: "Project broken into X epics, Y tasks across Z dependency waves. Review task-graph.md."

📝 Ledger: Planning, output: task-graph.md, epic/task/wave counts

**Phase 4: Development — spawn `sw-developer` agents (PARALLEL where the DAG allows)**

*DAG Analysis (MANDATORY before fan-out)* — from task-graph.md:
1. **Build the DAG**: per epic — what it produces (files, modules, APIs, schemas), what it consumes, which shared files it touches (routes, config, types, package.json).
2. **Independent clusters**: epics sharing NO files and NO dependency edges can run in parallel.
3. **Critical path**: longest sequential chain — the minimum build time.
4. **Conflict zones**: if two epics MIGHT touch the same file, run sequentially or let one go first to establish the pattern.

Include a wave visualization in the ledger, e.g. `Wave 1: [E-001 Auth] / Wave 2: [E-002] || [E-003] || [E-004] / Wave 3: [E-005 depends on E-002+E-003]`.

*Execution:*
1. **Foundation first** — one sw-developer builds scaffolding + shared layers (config, models, base utils, auth). Wait for it.
2. **Fan out** — ONE sw-developer per independent epic, concurrently (multiple Agent calls in a SINGLE message). Each gets ONLY its epic's tasks + shared context, told to stay strictly in scope so parallel agents never edit the same files.
3. **Next wave** — as epics finish and unblock others, spawn the next batch.
4. **Sequential fallback** — tightly coupled epics build in dependency order with a single developer. When unsure whether two epics conflict, run sequentially.
5. **⛔ Integration pass (MANDATORY when you parallelized)** — parallel agents build in isolation; the pieces may not wire together. Spawn ONE sw-developer to wire epics together (shared routes/types/config), resolve interface mismatches, run the FULL test suite and linter/build across the whole codebase. It must report green before you proceed.

Status after each epic: "Epic E-XXX complete. X tasks done, Y remaining." After integration: "All epics integrated, full suite green — ready for review."

📝 Ledger: per-epic entries with commit hashes; integration entry with full test results

**Phase 5: Code Review — spawn `code-reviewer` agents (PARALLEL by module for large codebases)**

> Skip if the profile disables `code_review`.

Large codebase: split by module/layer (auth, API, data/DB, frontend), spawn concurrently in one message. Small codebase: one reviewer. Input per agent: its files + plan.md + task-graph.md. Each runs tests/linters/SAST on its slice. **Merge** findings into one `review-report.md` with one overall verdict (CHANGES REQUIRED if ANY slice has a BLOCKER/MAJOR).

If CHANGES REQUIRED — **⛔ Fix Loop (Review)**:
1. Extract every MAJOR+ finding: file:line, severity, description, evidence (the tool output that found it).
2. Spawn sw-developer in Fix mode with ALL findings verbatim, e.g.:
   ```
   FINDING-1 [MAJOR]: SQL injection in src/api/search.ts:42
   - Evidence: ESLint-security flagged raw string interpolation in SQL query
   - Required fix: use parameterized queries
   ```
3. Re-review with the SAME reviewer scope, targeting changed + affected files only. The prompt MUST include the original findings and instruct: "For EACH finding report FIXED (with evidence) or STILL PRESENT (with evidence). Do not approve until ALL are addressed."
4. Repeat until APPROVED — each iteration appended to ledger.

📝 Ledger: Code Review, verdict, finding count, fix-loop iterations

**Phase 6: QA Testing — spawn `qa-engineer` agents (PARALLEL by playbook)**

> Skip if the profile disables `qa`. Otherwise tell each agent which sub-tests to run/skip per profile (`e2e_tests`, `load_test`, `dast`, `security_scan`, `accessibility`).

Split by independent playbooks and spawn concurrently in one message — e.g. UI/Playwright, API, database verification, unit/integration + load. One agent is fine for small projects. Each agent owns ONE playbook and reports bugs with tool evidence. Tell every agent: verdicts come from the REAL running system — production build, real database/cache, production-like config; mocked tests are developer evidence, never QA evidence. **Merge** into `bug-report.md`; overall REJECTED if ANY agent finds a CRITICAL/HIGH bug.

If bugs found — **⛔ Fix Loop (QA)**:
1. Extract every CRITICAL/HIGH bug: ID, severity, reproduction steps, expected vs actual, tool evidence, e.g.:
   ```
   BUG-001 [CRITICAL]: POST /api/orders returns 500 when cart is empty
   - Reproduce: curl -X POST localhost:3000/api/orders -d '{"items":[]}'
   - Expected: 400 validation error | Actual: 500 unhandled TypeError
   ```
2. Spawn sw-developer in Fix mode with ALL bugs verbatim.
3. Spawn code-reviewer to review the fixes.
4. Spawn qa-engineer with re-verification prompt: "Re-test EACH bug with the SAME reproduction steps; report FIXED (with evidence) or STILL PRESENT (with evidence). Also run regression tests."
5. Repeat until APPROVED — each iteration appended to ledger.

📝 Ledger: QA, verdict, bug count, fix-loop iterations

MANDATORY CHECKPOINT: "QA complete. Verdict: [APPROVED/X bugs remaining]. Ready for deployment?"

**Phase 6.5: Security Audit — spawn `security-auditor` (ONLY if profile includes `security_audit`)**

Input: codebase + plan.md + requirements.md. Task: comprehensive mode. Read `security-report.md`. If CRITICAL/HIGH findings: sw-developer Fix mode with specific findings → re-spawn security-auditor to re-verify those findings → repeat until fixed or user-accepted.

📝 Ledger: Security Audit, findings by severity, fix-loop iterations

**Phase 7 & 8: DevOps + Docs — spawn in PARALLEL**

> Honor the profile: `devops-engineer` only if `devops` enabled, `tech-writer` only if `docs` enabled. If both disabled, skip to final summary.

Spawn the enabled ones simultaneously: devops-engineer (CI/CD, Docker, monitoring → DEPLOYMENT.md); tech-writer (full docs suite → README.md + docs/). Wait for both.

📝 Ledger: DevOps; Docs

**Phase 8.5: Post-Deploy Canary (only if DevOps deployed to staging/production)**

The devops-engineer's Post-Deploy Canary should have run during Phase 7/8. Verify `.sdlc/canary-report.md` exists; check verdict HEALTHY / DEGRADED / ROLLBACK REQUIRED. If ROLLBACK REQUIRED: verify the rollback succeeded. If DEGRADED: "Canary shows degraded performance after deploy. Investigate?"

CHECKPOINT (if canary ran): "Post-deploy canary: [verdict]. Review canary-report.md."

📝 Ledger: Canary, verdict, metrics summary

**Phase 9: Redaction Guard (before final commit/push)**

1. Secrets scan: `grep -rn "AKIA\|sk-\|ghp_\|glpat-\|password\s*=\s*['\"]" src/ --include='*.ts' --include='*.js' --include='*.py' --include='*.go' --include='*.yml' --include='*.yaml'`
2. PII scan: hardcoded emails, phone numbers, IPs in non-test code
3. Verify `.env` and credential files are in `.gitignore`
4. `git diff --cached --name-only` — flag any `.env`, `*.pem`, `*.key`, `credentials.*`
5. Any hit: BLOCK the commit and fix first. Lightweight safety net, not a replacement for security-auditor.

📝 Ledger: Redaction Guard, findings

**DONE — Final Summary & Branch Disposition**

```
======================================
PROJECT COMPLETE

Files generated:
  - requirements.md    — X functional, Y non-functional requirements
  - plan.md            — Architecture with security
  - task-graph.md      — X epics, Y tasks across Z waves
  - .sdlc/preview/     — Visual preview (approved)
  - src/               — X files
  - tests/             — X tests, all passing (verified by running)
  - review-report.md   — APPROVED (verified via linters + security scanners)
  - bug-report.md      — APPROVED (0 bugs found via real tool testing)
  - security-report.md — [APPROVED / N/A per profile]
  - DEPLOYMENT.md      — CI/CD + Docker + monitoring (health checks pass)
  - docs/              — Full documentation (examples tested against running API)
  - .sdlc/progress.md  — Full build ledger

Next steps:
  1. Review prototypes one more time
  2. Deploy to staging
  3. Run smoke tests (we'll provide test script)
  4. Deploy to production
======================================
```

**⛔ Branch Disposition (mandatory — always present these options).** Detect git state, show branch name and commits ahead of base, then:

1. **Merge locally** — `git checkout [base] && git merge [branch]`; verify no conflicts, report result
2. **Push & create PR** — `git push -u origin [branch]` then `gh pr create` with title/body from the pipeline summary
3. **Keep as-is** — do nothing; confirm branch name for later
4. **Discard** (⚠️ irreversible) — confirm twice, then `git checkout [base] && git branch -D [branch]`

📝 Ledger: Completion, disposition chosen, PR URL if applicable

### Command: `add` (New Feature)

> **MVP profile → MVP Fast Path** scoped to the feature (Quick Scope → build under the Evolvability Contract → smoke QA → debt.md). Steps below are for Small / Standard / Production.

1. Scan existing codebase (orchestrator reads directly)
2. Requirements interview for the feature — **MUST include The Grill (Step 3.5) and Prototype Walkthrough Choice (Step 6.5). No exceptions.**
3. Spawn sw-architect (hybrid mode — impact analysis)
4. Visual Preview (if UI feature) — spawn preview, present to user
5. Spawn task-planner
6. Spawn sw-developer -> code-reviewer -> qa-engineer (fix loops as needed)
7. Branch Disposition

### Command: `del` (Remove Feature)

1. Scan codebase for the feature's files, routes, models, tests
2. Spawn sw-architect (removal impact analysis)
3. CHECKPOINT: "Removing [feature] affects [X] files. [Things that break]. Proceed?"
4. Spawn task-planner -> sw-developer -> code-reviewer -> qa-engineer (regression test)
5. Spawn tech-writer (update docs)
6. Branch Disposition

### Command: `modify` (Refactor/Improve)

> **MVP profile →** skip sw-architect and task-planner: orchestrator writes the change sketch into `mvp-brief.md`, one sw-developer executes under the Evolvability Contract, smoke QA, debt.md updated. Steps below are for Small / Standard / Production.

1. Spawn sw-architect (codebase analysis mode)
2. CHECKPOINT: "Found [X] issues. Top 3: [list]. Which to implement?"
3. Spawn task-planner -> sw-developer -> code-reviewer -> qa-engineer
4. Branch Disposition

### Command: `fix` (Bug Fix)

1. Ask: "What's happening? Expected? Error messages?" OR read existing bug-report.md
2. Spawn qa-engineer (diagnose mode) -> bug-report.md
3. Spawn sw-developer (fix + regression tests) -> code-reviewer -> qa-engineer (retest + regression)
4. Loop step 3 until APPROVED
5. Branch Disposition

### Command: `deploy`
Spawn devops-engineer. Done.

### Command: `review`
Spawn code-reviewer. If issues found, offer to fix.

### Command: `test`
Spawn qa-engineer. If bugs found, offer to fix.

### Command: `docs`
Spawn tech-writer. Done.

### Command: `audit`
Spawn security-auditor — user specifies daily (zero-noise, 8/10 confidence) or comprehensive (deep scan, 2/10 confidence); default daily. Read `security-report.md`. If CRITICAL/HIGH findings, offer sw-developer fix, then re-audit those findings.

### Command: `promote` (MVP → Proper Software)

The payoff of the Evolvability Contract: upgrade an MVP built by the Fast Path (or any rough codebase) into proper software without a rewrite.

1. **Debt review (orchestrator).** Read `.sdlc/debt.md` + `mvp-brief.md` (if missing: scan the code for `MVP-SHORTCUT` markers and reconstruct the debt list first). Present the debt summary: "Here's what was deliberately skipped. Promoting means fixing these + full requirements/architecture/review/QA."
2. **Ask the target profile** (Step 0.5 table minus MVP — default Standard). The tail phases follow that profile.
3. **Full requirements — NOW with The Grill.** The MVP is a working prototype: interview around what the user learned from using it (what worked, what's missing, what changed). Grill and requirements checkpoint apply in full. Output: real `requirements.md`; mvp-brief.md is input, then superseded.
4. **Spawn `sw-architect` (hybrid mode).** Input: requirements.md + existing code + debt.md. Task: gap analysis — what stands as-is, what gets refactored, what gets rebuilt; full security architecture. Output: plan.md. Architecture checkpoint applies.
5. **Spawn `task-planner`.** Tasks MUST cover every debt.md item (retire or explicitly user-accept each one) plus new requirements. Output: task-graph.md.
6. **Standard core from here**: sw-developer (parallel per DAG, integration pass) → code-reviewer → qa-engineer with fix loops, then the chosen profile's tail (security audit / devops / docs as enabled). Rule 5 applies to debt items: each one ends verified-fixed or user-accepted — findings never die.
7. **Close out**: mark `.sdlc/debt.md` items retired, Redaction Guard, final summary + Branch Disposition.

📝 Ledger: Promote entries per phase; debt items tracked like MAJOR findings

### Command: `plan`
1. Requirements interview — **MUST include The Grill and Prototype Walkthrough Choice. No exceptions.**
2. Spawn sw-architect -> plan.md
3. Visual Preview (if UI project)
4. Spawn task-planner -> task-graph.md
5. Stop — no code.

### Command: `resume`
1. Read `.sdlc/progress.md` FIRST (authoritative); if missing, fall back to file detection
2. Determine where the pipeline stopped (last ledger entry + next expected phase)
3. Ask: "I see [X, Y] done. Continue from [next step]?" then spawn the next agent
4. 📝 Ledger: append "Resumed" entry with timestamp and starting phase

*All commands: append every phase (including fix-loop iterations) to the ledger.*

---

## Agent Spawning Rules

| Rule | Details |
|------|---------|
| **Spawn by agentType** | Use the tuned subagent types — `sw-architect`, `task-planner`, `sw-developer`, `code-reviewer`, `qa-engineer`, `devops-engineer`, `tech-writer`, `security-auditor`. Each agent definition sets its model tier alias (opus/sonnet/haiku) and role-scoped tools — the agent files are the source of truth for model selection; do NOT override them when spawning. `req-engineer` is NOT an agent — it runs in the main conversation. The `devops-engineer`, `tech-writer`, `security-auditor`, `benchmark`, and `health` agents live in the companion `sdlc` plugin — if it isn't installed, tell the user to install it or skip those phases per the build profile. |
| **Model selection: least powerful that handles the role** | Capable models for judgment-heavy roles (architecture, review, QA, security); cheaper/faster for mechanical execution (dev, devops, docs, planning). Already encoded in the agent definitions — do NOT override. One-off helpers (e.g. preview generator): `sonnet` for code generation, `haiku` for pure mechanical tasks. Never `opus` for tasks not requiring deep judgment. |
| **Always pass full context** | Every agent gets paths to ALL relevant docs + working directory + its assigned scope |
| **Parallelize independent work** | Fan out concurrently (multiple Agent calls in ONE message) when work shares no state: independent epics, review modules, QA playbooks, DevOps + tech-writer. The main speed lever. |
| **Sequential only on real dependencies** | When one unit's output feeds the next, or two units edit the same files. When unsure, prefer sequential. |
| **Build foundation before fan-out** | One agent builds shared scaffolding/layers first; parallelize only what's genuinely unblocked. |
| **Read output before next** | Read/merge agent output files for checkpoint info and next-phase context |
| **Retry once on failure** | If it fails again, escalate with clear error and recovery steps |
| **Pass user feedback** | Re-spawn ONLY the rejected agent with feedback appended |
| **Continuous execution** | In semi-autonomous/autonomous modes, do NOT pause between non-checkpoint phases — spawn the next agent immediately. Only pause at mandatory checkpoints. |

---

## Agent Tool Execution Requirements

**CRITICAL**: Every agent MUST execute real tools and report evidence — never claim success by "reading code" or "assuming it works." If any tool fails, the agent STOPS and reports the failure with error, file/line, and suggested fix.

| Agent | Must Execute |
|-------|--------------|
| **req-engineer** | WebSearch to validate competitive features; build HTML/CSS UI prototypes; run examples to verify API specs |
| **sw-architect** | Compile/run existing code; SAST (Bandit, Semgrep); dependency scanners (npm audit, pip-audit); POC for risky decisions |
| **task-planner** | Validate design system with actual component libraries; test responsive breakpoints; verify WCAG accessibility |
| **sw-developer** | Run dev server; unit tests; linter; Docker build; verify compile; start the app and hit it (curl/Playwright) |
| **code-reviewer** | Tests; linters; SAST (Bandit, Semgrep, ESLint-security); Docker build; dependency CVE scan |
| **qa-engineer** | Playwright for UI; curl/httpx for APIs; direct DB queries; unit suite; bug report with tool output |
| **devops-engineer** | Docker build; CI/CD test; health checks; rollback test; load tests; backup/restore drills |
| **tech-writer** | Test API examples against running endpoints; run Quick Start fresh; execute CLI commands; verify links; compile examples |
| **security-auditor** | Git-history secret scan; npm audit/pip-audit; OWASP Top 10 tests; SAST; verify findings via active exploitation |

**Orchestrator provides each agent**: working directory; pre-installed tools; input documents; error-recovery support (catch, analyze, fix/install, retry, escalate); evidence collection (logs, test results, screenshots saved); ledger context from `.sdlc/progress.md`.

---

## Agent Failure Recovery

When an agent's tooling fails (tests, Docker build, etc.): analyze the error → try auto-fix (install dependency, clear cache) → retry. If retry passes, continue without interrupting the user. If it fails, escalate with the clear error message, file/line, and a copy-pasteable fix command; re-run after the user fixes; if it still fails, escalate again for human debugging. Agent failures are recoverable without aborting the pipeline when possible.

### Agent Prompt Template

```
You are acting as a senior [role] for this project.
Follow the [skill-name] skill instructions.

Project context:
- Working directory: [absolute path]
- Tech stack: [from plan.md or detected]
- Project phase: [current pipeline position]

Input files:
- requirements.md / plan.md / task-graph.md: [paths, if they exist]
- Existing code: [path] (if exists)
- Progress ledger: .sdlc/progress.md (read for context on prior phases)

Available MCP servers and tools:
[Inventory discovered at startup, e.g. "MongoDB MCP: connected — tools: find,
count, aggregate, ... Use mcp__mongodb__* for ALL database operations instead
of CLI clients." If none: "No MCP servers connected. Use CLI tools."]

Your task:
[Specific instruction for this phase]

Write your output to: [specific file path]
Return only a short summary (<=15 lines): verdict, counts, artifact paths, flagged items — full detail goes in the output file.

[Any user feedback or constraints]

[For fix loops — include specific findings verbatim:]
Fix these specific findings:
[FINDING-1]: [details]
```

---

## Checkpoint Rules

| Checkpoint | When | Mandatory? |
|-----------|------|-----------|
| After requirements | Before architect | YES |
| After architecture | Before preview/planner | YES |
| After preview | Before planner (UI projects) | YES (skip for non-UI) |
| After project plan | Before developer | Guided mode only |
| After each epic | During development | Guided mode only |
| After code review (if issues) | Before re-spawning developer | Only if BLOCKERs |
| After QA | Before devops/security | YES |
| After security audit (if run) | Before devops/docs | Only if CRITICAL findings |
| Branch disposition | After everything | YES |
| Final summary | After everything | YES |

### Autonomy Levels

| Level | When | Checkpoints |
|-------|------|------------|
| **Guided** (default) | User seems new or project is complex | Every phase |
| **Semi-autonomous** | "Just check with me on the big stuff" | Requirements, architecture, preview, QA, final |
| **Autonomous** | "Just build it" / "don't bother me" | Requirements (mandatory), final only |

Detect from language: detailed instructions = Guided; "handle it" = Autonomous.

**Autonomy still requires requirements validation.** In Autonomous mode, ask one question at a time unless the user says Skip, Decide for me, or Use smart defaults. Those choices let the workflow resolve gaps without further interview messages, but it must still present the resulting requirements or MVP brief for one final approval before coding.

**⛔ Continuous execution in autonomous/semi-autonomous mode.** Between non-checkpoint phases: no "Ready to proceed?", no waiting for confirmation, no summarize-and-ask. Spawn the next agent immediately, update the ledger, give a one-line status, keep going.

---

## Error Recovery

| Situation | Action |
|-----------|--------|
| Agent fails | Retry once. If still fails, tell user. |
| User rejects checkpoint | Append feedback, re-spawn ONLY that agent. |
| Requirements change mid-pipeline | Re-run from affected agent forward. Ledger: "Requirements changed" entry. |
| User wants to skip a question | Record the gap as an assumption or risk and ask the next single question. If they choose Use smart defaults, resolve the remaining gaps and present the complete requirements summary for approval. |
| QA finds >10 bugs | Suggest re-reviewing architecture first. |
| Fix-review-QA loop >3 iterations | Stop. Suggest architect reassessment. Ledger: "Fix loop exceeded — escalated." |
| Conversation interrupted | On resume, read `.sdlc/progress.md`. Never rely on memory alone. |
| Ledger missing on resume | Fall back to file detection. Warn user; recreate ledger from detected state. |

---

## Status Updates

Between agents:

```
--------------------------------------
completed: Requirements (requirements.md)
running:   Architecture agent...
--------------------------------------
```

After the full pipeline: the PROJECT COMPLETE summary (see `new` pipeline), then immediately Branch Disposition.

## Tool Execution Philosophy

Everything is proved with tools, nothing is assumed. Never "the code looks correct / the API should work / docs seem accurate" — instead: run the tests, curl the endpoints, query the database, build and boot the Docker image, run the Quick Start, run the scanners, measure coverage, scan git history for secrets. Every claim in every report is backed by real tool output.
