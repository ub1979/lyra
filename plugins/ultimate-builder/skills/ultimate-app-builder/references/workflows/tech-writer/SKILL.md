---
name: tech-writer
description: Reads the finished codebase and plans, then generates the complete verified documentation suite — README, API docs, user/developer/deployment guides, changelog, troubleshooting. Use when the user mentions: write docs, documentation, README, API docs, user guide, developer guide, deployment guide, changelog, troubleshooting, onboarding.
---

# Technical Writer

> ⛔ MUST be executed as a spawned Agent. The orchestrator does not get to "write a quick README" and call it documentation — spawn this skill.
> A spawned agent following every step below, testing all examples, producing `README.md` + `docs/`, counts. Anything less does not.

> ⛔ IRON LAW: no doc section is complete without fresh tool-execution evidence from THIS session. "Should work" is forbidden.
> Gate for EVERY section: IDENTIFY the verification command → RUN it → READ the output → VERIFY it matches the doc → only then mark complete.
> If a documented example fails when tested → fix the docs (or the code, if that's the root cause) before publishing.

---

## Step 0 — Detect Input Mode

1. **Full pipeline** — codebase path + `plan.md` + `requirements.md` + `task-graph.md` → generate the complete suite.
2. **Codebase only** — read the code, generate docs from what's discovered.
3. **Specific doc** — generate just the requested document (README, API docs, deployment guide, ...).
4. **Update docs** — read current docs + current code, identify discrepancies, update.

Inline args: `--path`, `--plan`, `--requirements`, `--task-graph`, `--output` (docs dir), `--format` (markdown/html/both).

---

## Step 1 — Understand the System

1. **Read provided docs**: `requirements.md` (what/for whom), `plan.md` (architecture, stack, security, infra), `task-graph.md` (features, stories, design system).
2. **Read the codebase**: entry points; every API route (method, params, responses); data models and validation; config/env vars/feature flags; auth and roles; error format; tests and how to run them; build/deploy scripts; existing docs (missing/outdated); design system if UI (colors, typography, spacing, components, breakpoints).
3. **Identify audiences**: end users → user guide; API consumers → API docs; contributors → developer guide; operators → deployment + troubleshooting.
4. **Identify project type** (determines the primary doc): API/backend → API docs; UI/frontend → user guide with visuals; CLI → command reference; library/SDK → API reference with code examples; full-stack → all.

---

## Step 2 — Verify Documentation Accuracy With Tools (Mandatory)

Test everything BEFORE publishing:

| Doc claim | Required verification |
|---|---|
| Quick Start | Run every step in a clean container, capture output |
| API endpoint example | `curl` the running endpoint, capture the real response |
| Code example | Execute/compile it, show it runs |
| CLI command | Run it, capture output |
| Installation steps | Execute in a clean environment |
| Env var table | Cross-reference `.env.example` with `grep -r` for actual usage |
| Database setup | Run migrations, verify tables exist |
| Test commands | Run the suite, show pass/fail |

```bash
# Start the app, then curl EVERY documented endpoint
npm run dev &  # or python manage.py runserver
sleep 3
curl http://localhost:3000/api/v1/users -H "Content-Type: application/json" \
  -d '{"name":"Alice","email":"alice@test.com"}' | jq .

# Quick Start end-to-end in a clean container
docker run --rm -v "$PWD":/app node:20-alpine sh -c \
  "cd /app && npm install && npm run build && npm test && (npm start &) && sleep 3 && curl http://localhost:3000"

# Link check
for link in $(grep -oh 'https\?://[^) ]*' docs/*.md); do
  curl -sI "$link" | grep -q 200 && echo "OK $link" || echo "BROKEN $link"
done

# Execute code examples from docs (npx ts-node / python -m py_compile as applicable)
```

Per-document checklist before declaring it complete:

```
□ Every code example executed, output captured
□ Every CLI command run and verified
□ Every API example curled against a running instance
□ Every referenced file path exists in the project
□ Every listed env var confirmed in use via grep -r
□ Version numbers match package.json / pyproject.toml
□ Quick Start run end-to-end in a clean environment (Docker)
□ Internal links resolve; external links return 200
□ Screenshots match current UI state (if UI project)
```

Save verification evidence (commands, output, timestamps) to `docs/.verification-log.md` — proof the docs were tested, not just written.

---

## Step 3 — Organize With the Diataxis Framework

Four modes ([diataxis.fr](https://diataxis.fr/)) — never mix them in one section:

- **Tutorial** (learning): step-by-step from zero, verified error-free in a clean env, expected outcome per step ("you should see..."), one path only (alternatives noted at the end).
- **How-to** (task): goal first, prerequisites up top, numbered single-action steps, expected output after key steps, end with verification.
- **Reference** (lookup): complete and structured — tables, consistent format, no narrative; types/defaults/constraints/examples for every field; cross-link to how-tos.
- **Explanation** (understanding): answers "why", compares alternatives, diagrams and mental models; links to reference for specifics.

Mapping: README Quick Start = Tutorial · user-guide = How-to (+ Getting Started tutorial) · developer-guide = How-to + Reference (+ architecture explanation) · api.md = Reference · deployment-guide = How-to (+ env var reference) · troubleshooting = How-to (+ error-code reference) · changelog = Reference · architecture.md = Explanation.

---

## Step 4 — Generate the Documentation Suite

Write to `<project-root>/docs/` (or `--output`). EVERY document starts with a metadata header:

```markdown
> **Version**: [matches package.json/pyproject.toml]
> **Last verified**: [date verification ran]
> **Prerequisites**: [required installs/config]
> **Expected time**: [e.g., "5 minutes"]
```

### 1. README.md (project root) — Quick Start MUST be tested

Sections: one-line description · What is this? (2-3 sentences for a stranger) · Quick Start (zero to running in <5 steps; works on a fresh machine with only Docker) · Features (from requirements.md) · Tech Stack table (layer, technology, version — from plan.md) · Documentation (links to all docs below) · Contributing (link to developer guide, PR process) · License.

Understandable in 30 seconds; link to detail docs, never duplicate them.

### 2. docs/api.md — every example tested against running endpoints

Generate from actual route definitions, not assumptions. Sections: Authentication (token format, how to obtain) · Common Patterns (pagination format, standard error shape documented once, rate limiting) · Endpoints grouped by resource.

Per endpoint:

```markdown
#### METHOD /path
**Description** · **Auth**: [role|public] · **Rate limit**: [tier]

**Request**:
| Field | Type | Required | Validation | Example |
|---|---|---|---|---|

**Response (200)**: [JSON captured from a real curl — not hand-crafted]

**Errors**:
| Code | Condition | Response |
|---|---|---|
```

Document all response codes (200/400/401/403/404/422/500) with realistic data.

⛔ Per-endpoint verification rule: start the server → run the exact `curl` from the doc → compare with the documented response → if they differ, update the docs → save the actual captured response as the example.

OpenAPI (when applicable): generate `docs/openapi.yaml` from routes; lint with `npx @redocly/cli lint`; cross-check endpoint counts vs api.md; if the framework auto-generates a spec (FastAPI, NestJS), diff it against the served spec.

### 3. docs/developer-guide.md

Sections: Prerequisites (exact versions, verified with `node --version` etc.) · Setup (git clone → running app + tests, every step tested in a clean env) · Project Structure (tree with per-directory explanation) · Architecture Overview (diagram, request flow) · Coding Standards (naming, patterns, linter config) · Adding a New Feature (tutorial walkthrough) · Adding a New API Endpoint (how-to with boilerplate) · Database (migrations, seeding, local access) · Testing (run/write/coverage, with example output) · Environment Variables (table: Variable, Description, Required, Default, Example — cross-referenced with `.env.example`) · Common Tasks · Troubleshooting (Problem | Cause | Solution).

### 4. docs/deployment-guide.md

Pull from `DEPLOYMENT.md` (devops-engineer) if it exists, else generate. Sections: Environments (dev/staging/prod — URLs, access, differences) · Deployment Process (PR → production, CI/CD diagram) · Production Env Vars (with WHERE to set them) · Rollback (exact tested commands) · Monitoring (dashboards, health checks, log locations) · Backup & Recovery (schedule, manual backup, restore) · Incident Response (contacts, escalation, runbooks) · SSL/DNS (certs, records, renewal) · Common Deployment Errors (Error | Cause | Fix).

### 5. docs/user-guide.md (UI/CLI projects) — for non-developers

Sections: Getting Started (account creation, first login, setup) · Features (step-by-step per feature) · FAQ (Question | Answer) · Keyboard Shortcuts (if applicable).

MANDATORY for projects with a frontend:
- **Visuals**: screenshots of every major screen/workflow from the running app (or reference the HTML prototypes from the requirements phase if headless); annotate complex UIs with numbered callouts; store in `docs/images/` with descriptive names (`dashboard-overview.png`).
- **Design system**: colors (hex), typography, spacing scale, component library, responsive breakpoints, dark/light mode.
- **Workflow walkthroughs** (Tutorial mode): what to click, what you should see after each action, common mistakes and recovery.
- **Accessibility**: keyboard navigation, screen reader notes, contrast compliance status.

### 6. docs/troubleshooting.md

Organized by SYMPTOM (what users see), not cause. Sections: How to Use This Guide · Installation Issues · Runtime Errors · API Errors (per status code: when triggered, cause, fix for consumer vs operator) · Database Issues · Deployment Issues · Performance Issues · FAQ.

Per entry: error message/symptom → **Cause** → **Fix** (exact tested commands) → **Expected result** (so users know it worked). Source from real bug reports, QA findings, and common pitfalls for the stack. Cross-reference api.md error codes.

### 7. docs/changelog.md

[Keep a Changelog](https://keepachangelog.com/) format. Per version: Added (with requirement IDs) / Changed / Fixed (with issue refs) / Security / Deprecated / Removed.

### 8. docs/architecture.md — Explanation mode ("why", not "how")

Sections: Overview (high-level system diagram) · Key Decisions (per decision: Context, Decision, Alternatives considered, Consequences) · Data Flow (request lifecycle with diagram) · Security Model (trust boundaries, auth flow, encryption — from plan.md) · Scaling Strategy (bottlenecks, limits).

---

## Step 5 — Cross-Reference & Consistency Check

Verify before finalizing:

- Every endpoint in code is in api.md; every env var in `.env.example`/code is documented
- Code examples match current code; no stale versions or deprecated features; terminology consistent; screenshots current
- Version numbers consistent across all docs and matching package.json/pyproject.toml
- Every doc has the metadata header; every section uses the correct Diataxis mode

```bash
echo "Endpoints: code=$(grep -rn "router\.\|app\.\(get\|post\|put\|delete\|patch\)" src/ | wc -l) docs=$(grep -c "^####.*\(GET\|POST\|PUT\|DELETE\|PATCH\)" docs/api.md)"
echo "Env vars in code: $(grep -roh "process\.env\.\w\+" src/ | sort -u | wc -l)"  # or os.environ/os.getenv
for f in docs/*.md README.md; do
  grep -oP '\[.*?\]\((docs/.*?\.md)\)' "$f" | grep -oP '\(\K[^)]+' | while read t; do
    [ -f "$t" ] || echo "BROKEN: $f -> $t"
  done
done
echo "package.json: $(jq -r .version package.json 2>/dev/null)"; grep -H "Version" docs/*.md README.md
```

---

## Step 6 — Summary

Present: documents created (paths) · endpoint coverage (documented vs code) · env var coverage · gaps found · verification evidence (examples tested, pass/fail) · Diataxis categorization per doc · suggestion to re-run the Quick Start on a fresh machine.

```
Documentation Verification Report
Quick Start:    TESTED in clean container — all steps pass
API endpoints:  X/Y curled — responses match docs
Code examples:  X executed — all run
Links:          X internal / Y external checked — broken ones listed
Env vars:       X/Y documented — missing ones listed
Version:        all docs match package.json vN.N.N
Screenshots:    X captured from running app (if UI)
```

---

## Completion Checklist

```
ALL PROJECTS:
□ README.md — tested Quick Start
□ docs/api.md — every endpoint tested (docs/cli-reference.md for CLI tools)
□ docs/developer-guide.md — tested setup
□ docs/deployment-guide.md — tested steps
□ docs/troubleshooting.md — symptom-based
□ docs/changelog.md — current version history
□ docs/architecture.md — decision records + diagrams
□ docs/.verification-log.md — test evidence

UI PROJECTS: □ docs/user-guide.md with visuals □ docs/images/ annotated screenshots
□ design system documented □ responsive breakpoints documented

API PROJECTS: □ validated docs/openapi.yaml (if supported) □ real captured curl
response per endpoint □ auth flow with token acquisition example

LIBRARY/SDK: □ docs/api-reference.md (every public symbol) □ docs/tutorials/ with
working examples □ docs/migration-guide.md if upgrading

RECOMMENDED: □ docs/tutorials/ □ docs/adr/ □ SECURITY.md □ CONTRIBUTING.md
```

---

## Principles

- Write for a reader who knows nothing. Every step explicit: `npx prisma migrate dev`, not "run the migrations". No undefined jargon.
- Examples over explanations, with realistic data.
- One source of truth — link, don't duplicate. Docs live in the repo, change with the code, get reviewed in PRs.
- Outdated docs are worse than none. Every claim verified: if you wrote "returns 200", you saw 200 this session.
- Diataxis discipline — know which mode you're writing in.
- Screenshots decay — note which app version they reflect. Alt text on images, semantic headings, no color-only information.
