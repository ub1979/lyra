# Build scale gate — 2026-09-11

User problem and reproduction: A new private application intended for one or
two uses entered the full Product workflow and produced a 70-task plan with
release, notarization, penetration, operations, and exhaustive hardening work.
The legacy coordinator described build profiles, but Studio did not require a
scale choice before requirements and planning, while the active umbrella
workflow defaulted an unanswered choice to Product.

In scope / explicitly deferred: Require a plain-language scale choice for new
guided projects before requirements, team expansion, planning, or code. Treat
an explicit launcher template as that choice. Make personal/one-off work use a
bounded MVP path and make task planning refuse to inflate that profile into a
production graph. Existing projects and explicitly selected review/fix flows
remain usable without a new mandatory gate. This change does not migrate or
delete existing project plans automatically.

Acceptance criteria:

- The default guided new-project route cannot silently choose Product.
- The user sees Personal / one-off, Reusable project, and Production / public
  choices before a new build starts.
- The chosen profile is carried in the setup prompt and is authoritative.
- Direct guided-chat setup asks the same one-question choice when no launcher
  selection exists.
- Personal / one-off work cannot invoke the full requirements Grill,
  architecture plan, task graph, dedicated security epic, deployment, or
  release pipeline unless the user explicitly adds one of those outcomes.
- Product task graphs remain proportional and require a user scope decision
  before exceeding 25 work items.

Affected modules and data: Ultimate Builder coordinator, requirements and task
planning instructions; Studio launcher setup payload; guided-chat setup prompt;
workflow contract tests and generated dashboard bundle. No user project data or
credentials are changed.

Tests and observed results: All 109 Ultimate Builder plugin/contract tests
passed. The web TypeScript check, 404 web tests, and production web build
passed; lint completed with no errors and 31 pre-existing warnings. Dashboard
source/build parity, JavaScript syntax, JSON parsing, changed-file whitespace,
and the Lyra file-map check passed. The repository virtual-environment Python
crashed before collecting tests, so the Python suite was also run successfully
in an isolated Python 3.12 environment.

Compatibility / restart: Existing saved projects and conversations are retained.
A Lyra restart is required for new sessions to receive the updated prompt and
dashboard bundle.

Rollback / retained recovery data: Revert the focused local commit. Existing
project files, Kanban jobs, and histories remain intact.

Local commit / authorized push: Local commit required after verification. No
remote push is authorized.
