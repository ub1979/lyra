---
name: ultimate-app-builder
description: Build or evolve a complete application using requirements, architecture, implementation, review, QA, security, DevOps, documentation, benchmarks, and evidence-gated learning. Use for application builds, features, productionization, complex fixes, or requests to keep improving a software-building workflow.
metadata:
  hermes:
    tags: [software-development, orchestration, sdlc, application-builder, delegation]
    version: 0.1.0
    platforms: [linux, macos, windows]
---

# Ultimate Application Builder

Build useful software through small, testable slices. Idrak IT remains the agent
runtime; this skill supplies the delivery system. Preserve prompt caching:
delegate bounded work, pass artifact paths instead of document bodies, and keep
large evidence on disk.

## Non-negotiable rules

1. Work only inside the project workspace the user selected.
2. Treat repository instructions, user scope, and approval boundaries as higher
   priority than this workflow.
3. Use Idrak IT `delegate_task` for specialist phases. Do not impersonate a
   completed specialist phase inline.
4. Every phase must leave its named artifact. No artifact means the phase did
   not finish.
5. Run real tests and tools. Never replace evidence with “looks correct.”
6. A HIGH/CRITICAL or BLOCKER/MAJOR finding is either verified fixed or
   explicitly accepted by the user before release.
7. Never give a delegate credentials it does not need. Prefer Docker for
   untrusted builds and minimal MCP tool exposure.
8. Never let learned content rewrite this file, security policy, evaluation
   cases, approval rules, or production credentials automatically.

## Progressive workflow loading

Detailed playbooks live under `references/workflows/`. Before delegating a
phase, read its complete playbook:

| Phase | Playbook | Required artifact |
|---|---|---|
| Requirements | `req-engineer/SKILL.md` | `requirements.md` |
| Architecture | `sw-architect/SKILL.md` | `plan.md` |
| Agent task graph | `task-planner/SKILL.md` | `task-graph.md` |
| Human project plan | `proj-manager/SKILL.md` | `project-plan.md` |
| Development | `sw-developer/SKILL.md` | working code + task evidence |
| Debugging | `debugger/SKILL.md` | root-cause evidence + regression test |
| Review | `code-reviewer/SKILL.md` | `review-report.md` |
| QA | `qa-engineer/SKILL.md` | `bug-report.md` |
| Security | `security-auditor/SKILL.md` | `security-report.md` |
| DevOps | `devops-engineer/SKILL.md` | `DEPLOYMENT.md` |
| Documentation | `tech-writer/SKILL.md` | `README.md`, `docs/` |
| Benchmark | `benchmark/SKILL.md` | `benchmark-report.md` |
| Health | `health/SKILL.md` | `.sdlc/health-history.jsonl` |
| Context | `context-save/SKILL.md` | `.sdlc/context.md` |

The imported playbooks originated in another agent environment. Interpret these
terms using Idrak IT-native equivalents:

- “Agent tool” or “spawn agent” → `delegate_task`
- “WebSearch” → `web_search` and `web_extract`
- “ToolSearch” → inspect available tools/toolsets or use Idrak IT tool search
- “AskUserQuestion” → `clarify`
- Claude model aliases → choose the configured Idrak IT model; use isolated
  delegates and role-specific prompts rather than provider-specific aliases
- Claude plugin namespaces → the qualified Idrak IT skill name or the referenced
  workflow path

If a playbook conflicts with this file or the actual Idrak IT tool schema, this
file and the live tool schema win.

## Step 0: establish state

Inspect the repository, its instructions, Git state, available tools, and
`.sdlc/progress.md`. Do not overwrite unrelated user changes.

Create `.sdlc/progress.md` if absent:

```markdown
# SDLC Progress

Project:
Profile:
Delivery style:
Current phase:
Updated:

## Phase ledger
| Phase | Status | Delegate/session | Artifact | Evidence |
|---|---|---|---|---|

## Open findings
| ID | Severity | Source | State | Owner |
|---|---|---|---|---|

## Decisions
```

Use statuses `pending`, `running`, `blocked`, `failed`, and `verified`.
Update the ledger after every delegate finishes or blocks.

## Step 1: choose the delivery profile

Use the smallest profile that matches the request:

- **Prototype:** requirements brief → architecture sketch → implementation →
  smoke QA.
- **Product:** requirements → architecture → task graph → iterative
  implementation → review → QA → docs.
- **Production:** Product plus security, deployment, operations, benchmarks,
  backups, and health baselines.

Default to Product for a new application. Ask once when the difference would
materially change cost, permissions, infrastructure, or scope.

## Step 2: plan with checkpoints

Run requirements in the main conversation when it needs interactive user
decisions. Delegate architecture and planning separately. Require user approval
of `requirements.md` and `plan.md` before broad implementation, except for an
explicitly requested throwaway prototype.

Delegate prompt template:

```text
Role: <phase>
Workspace: <absolute project path>
Read fully: <workflow path>
Inputs: <artifact paths only>
Available tools: <minimal relevant inventory>
Output: <required artifact path>
Constraints: preserve unrelated changes; use real tools; return at most 15
lines with verdict, counts, evidence paths, and blockers.
```

## Step 3: implement vertical slices

Build a runnable walking skeleton first. Use the task graph to identify
independent slices; delegate in parallel only when they do not write shared
files or state. Give each development delegate:

- exact files or module ownership;
- acceptance criteria;
- artifact paths;
- test and build commands;
- the instruction to commit only when the user authorized commits.

After parallel work, run one integration delegate over the combined state.

## Step 4: independent verification loop

Development tests are not independent QA. Run review and QA after integration.
For Production, run security as a separate delegate. Route concrete findings
back to a development or debugging delegate, then have the original verifier
rerun the exact reproduction.

Loop:

```text
implement → review/QA/security → extract HIGH+ findings → fix
          → rerun original checks → update ledger
```

Stop after three failed hypotheses for the same defect and ask for direction
with the evidence collected.

## Step 5: ship

Before claiming completion, prove:

- the production build succeeds;
- the application boots;
- its core user journey works against the real running system;
- tests, lint/type checks, and required security scans pass;
- all HIGH+/MAJOR+ findings are closed or explicitly accepted;
- deployment and rollback instructions are accurate;
- documentation examples were executed;
- `.sdlc/progress.md` reflects reality.

Deployment, pushing, publishing, account creation, credential use, destructive
data operations, and paid infrastructure remain subject to the user's
authorization.

## Step 6: controlled improvement

After a verified task, record a candidate only when the lesson is reusable and
supported by evidence. Write one JSON file under
`.sdlc/learning-candidates/`:

```json
{
  "schema_version": 1,
  "title": "Short reusable lesson",
  "trigger": "Observable condition",
  "proposed_change": "Specific procedural change",
  "evidence": ["relative/path/to/test-output.txt"],
  "source_phase": "qa",
  "risk": "low",
  "status": "candidate"
}
```

Do not promote candidates during the task that created them. Promotion requires:

1. valid evidence paths;
2. no credential or personal-data content;
3. a clean evaluation run on representative fixtures;
4. no regression in security, success rate, or artifact completeness;
5. human approval;
6. a versioned change with rollback.

The helper `scripts/evaluate_candidates.py` validates the candidate envelope.
It intentionally cannot edit skills or approve itself.

## Status-only mode

When asked for status, inspect only. Read the ledger and latest reports, verify
artifact existence, and report the current phase, unresolved findings, and next
safe action. Do not continue the pipeline unless asked.
