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

Build useful software through small, testable slices. Lyra remains the agent
runtime; this skill supplies the delivery system. Preserve prompt caching:
delegate bounded work, pass artifact paths instead of document bodies, and keep
large evidence on disk.

## Non-negotiable rules

1. Work only inside the project workspace the user selected.
2. Treat repository instructions, user scope, and approval boundaries as higher
   priority than this workflow.
3. Use Lyra `delegate_task` for specialist phases. Do not impersonate a
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
9. Keep engineering identifiers and evidence in artifacts. Lyra's user-facing
   updates use plain product language and explicitly distinguish a completed
   slice from a completed application.

## Hermes tool capability contract

A loaded skill may use every Hermes tool present in the live session schema.
The skill text does not need a separate tool allowlist. Treat the live schema
as authoritative: never claim to have used a tool that is absent, gated, or
failed, and never confuse tool availability with permission for destructive,
paid, credentialed, or externally visible actions.

Before a mandatory phase depends on a capability, inspect the available tools.
Use the exact Hermes tool names documented here and in each specialist
playbook. If the preferred tool is unavailable:

1. use an available safe fallback that can still meet the acceptance criteria;
2. tell the user what capability is missing and what part of the work it blocks;
3. offer to enable or install it from this conversation instead of directing
   the user to a Settings page;
4. after consent, use an approved non-interactive `hermes tools` command when
   possible, or show the exact `/tools enable <toolset>` command for the user to
   send in the same chat;
5. require a clean session after the tool schema changes so prompt caching and
   tool-call validity remain intact.

Run dependency installation only after explicit approval. Capture API keys and
tokens only through a Hermes masked secret prompt. Never ask the user to paste
a secret into ordinary chat; if secure capture is unavailable, explain that
limitation and continue with a no-secret fallback when one exists.

## Standing artifacts

Two files outlive any single phase and are read by several agents. Both are
specified in `references/engineering-standards.md`:

- `.sdlc/class-map.md` — every unit, its file, its test, and when that test last
  actually ran. Read it instead of searching the tree; loading one unit is
  cheaper and more reliable than grepping for it.
- `.sdlc/changes/CR-<n>-<slug>.md` — written before any change to existing code:
  what changes, why, blast radius, the units it puts back in doubt, what QA must
  test, how to roll back. `sw-architect` writes the full analysis for structural
  work, `sw-developer` a short one for small fixes; `code-reviewer` checks the
  diff against it and `qa-engineer` scopes regression from it.

## Progressive workflow loading

Each detailed playbook is a registered plugin skill. Before starting or
delegating a phase, load its complete playbook with
`skill_view(name="ultimate-builder:<playbook>")`. Reading only this umbrella
skill does not count as running a specialist.

| Phase | Playbook | Required artifact |
|---|---|---|
| Requirements | `req-engineer` | `requirements.md` |
| Research | `researcher` | `research-report.md` |
| Design (any UI) | `ui-designer` | `design-brief.md` |
| Architecture | `sw-architect` | `plan.md` |
| Agent task graph | `task-planner` | `task-graph.md` |
| Human project plan | `proj-manager` | `project-plan.md` |
| Development | `sw-developer` | working code + task evidence |
| Debugging | `debugger` | root-cause evidence + regression test |
| Review | `code-reviewer` | `review-report.md` |
| QA | `qa-engineer` | `bug-report.md` |
| Security | `security-auditor` | `security-report.md` |
| DevOps | `devops-engineer` | `DEPLOYMENT.md` |
| Documentation | `tech-writer` | `README.md`, `docs/` |
| Benchmark | `benchmark` | `benchmark-report.md` |
| Health | `health` | `.sdlc/health-history.jsonl` |
| Context | `context-save` | `.sdlc/context.md` |
| Specification | `spec` | `spec.md` |
| Restructuring | `oop-restructurer` | `restructure-report.md` |
| Learning | `learn` | `.sdlc/learnings.jsonl` |
| Coordination | `idk_it` | `.sdlc/progress.md` |

The imported playbooks originated in another agent environment. Interpret these
terms using Lyra-native equivalents:

- “Agent tool” or “spawn agent” → `delegate_task`
- “WebSearch” → `web_search` and `web_extract`
- “ToolSearch” → inspect available tools/toolsets or use Lyra tool search
- “AskUserQuestion” → `clarify`
- Claude model aliases → choose the configured Lyra model; use isolated
  delegates and role-specific prompts rather than provider-specific aliases
- Claude plugin namespaces → the qualified Lyra skill name or the referenced
  workflow path

If a playbook conflicts with this file or the actual Lyra tool schema, this
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

Mirror each transition to the conversation with the phase protocol in the
`app-it` playbook: `[APP_IT_PHASE:<id>]` when a phase starts running,
`[APP_IT_PHASE_DONE:<id>]` when its artifact is verified. The ledger is the
durable record; the markers are what the dashboard reads to show the phase strip
and to start the next phase. Keep the two in step — a verified ledger row with
no marker leaves the chain stalled.

## Step 1: choose the delivery profile

When the launcher prompt includes enabled and disabled specialists, that
selection is authoritative:

- run only the enabled specialist phases, except Requirements, which is always
  available and runs first only when initial discovery or a material delta is
  needed;
- do not silently add a disabled phase because it normally appears in a
  delivery profile;
- a planning-only selection may inspect files and write requested planning
  artifacts, but must not modify application code;
- ask before adding a specialist that becomes necessary for safety or a
  user-requested outcome.

Requirements always belongs to the project, but does not run for every turn.
Load `skill_view(name="ultimate-builder:req-engineer")` before downstream work
when no approved requirements cover the first meaningful product brief, when
the user explicitly asks for requirements work, or when a change materially
affects scope, user-visible behavior, data, permissions, integrations, or
acceptance criteria. Do not reload it for status questions, operational
commands, approvals, ordinary in-scope feedback, or minor fixes. When it is
needed, its relevant interview, separate Grill, design-space exploration,
prototype walkthrough, and approval gate are mandatory. Do not begin affected
later phases until `requirements.md` exists and the user has approved it. Use a
focused delta for an established project rather than restarting discovery from
zero.

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

When guided setup provides a `specialist_models` mapping, use its model for
that specialist's `delegate_task` call. Pass it as top-level `model` for a
single delegate or on the matching item in a batch. Omit `model` when the
specialist has no assignment so delegation inherits its configured default.
Never apply one specialist's assignment to another phase. The coordinating
conversation remains on its session model. Exact assignments are
provider-specific. After a provider change, use only the replacement map the
user confirms in the dashboard. Do not guess a cross-provider equivalent or
reuse an unavailable id from the previous provider.

## Step 3: implement vertical slices

Build a runnable walking skeleton first. Use the task graph to identify
independent slices; delegate in parallel only when they do not write shared
files or state. Give each development delegate:

- exact files or module ownership;
- acceptance criteria;
- artifact paths;
- test and build commands;
- the instruction to create a local Git commit after verification. Never push
  to a remote unless the user explicitly asks.

After parallel work, run one integration delegate over the combined state.

## Step 4: independent verification loop

Development tests are not independent QA. Run review and QA after integration.
For Production, run security as a separate delegate. Route concrete findings
back to a development or debugging delegate, then have the original verifier
rerun the exact reproduction.

QA and security delegates always receive the **full workspace** as their test
scope — not just the changed artifact paths. Set `Inputs:` to the workspace
root and append a "Changed:" note listing what was modified so the verifier
knows the trigger, but require Step 0 mode "Full pipeline" or "Codebase only"
so the entire running system is tested, not just the changed slice.
Code-reviewer remains diff-scoped.

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
safe action. Do not continue the pipeline unless asked. Lead with an explicit
"The application is finished" or "The application is not finished yet."
Describe completed and remaining work as things the user can do, not roadmap
codes, change-request numbers, filenames, migrations, schemas, or raw test
counts. Offer those technical details only when the user asks for them.
