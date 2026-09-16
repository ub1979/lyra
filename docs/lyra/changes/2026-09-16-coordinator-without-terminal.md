# Coordinator without a shell — 2026-09-16

Change / date: remove `terminal`/`process` (and the orphaned
`read_terminal`/`close_terminal`) from the Studio coordinator's `project-guide`
bundle and teach the playbook to dispatch through `project_run`; 16 September
2026.

User problem and reproduction: Lyra is meant to interview, dispatch specialists
and read their summaries. 0.19.37 only *instructed* the model to behave that
way; nothing enforced it, and one project chat shows the coordinator running
700 shell commands and 307 file reads itself (90 % of a 571k-token context).
Audit item LYR-06.

In scope / explicitly deferred: `toolsets.py` `project-guide` drops the
`terminal` include and the two terminal helpers; read-only and write file tools
stay because the coordinator still writes `requirements.md` during the
interview. `plugins/ultimate-builder/skills/app-it/SKILL.md` rewrites the four
shell-bound instructions (queue, status before every report, the raw
`hermes kanban create` fallback — removed, and the Git duty, which now belongs
to the specialist jobs). `web/src/lib/guided-agent-routing.ts` names the tool in
the per-turn directive. `workflow_contract.json` gains the enforced rule
`coordinator-dispatch-only` (contract 1.0.3). Deferred: removing `write_file`/
`patch` from the coordinator, and the `HERMES_TUI_TOOLSETS` explicit override,
which still bypasses trimming as an escape hatch.

Acceptance criteria: the resolved coordinator toolset contains none of
`terminal`, `process`, `read_terminal`, `close_terminal`; `project_run` joins the
bundle through the registry; the coordinator schema stays under 0.8× the coding
profile; the contract reports the new enforced rule; existing routing tests
pass with the new directive text.

Affected modules and data: `toolsets.py`, `tui_gateway/studio_context.py`
(comment), `plugins/ultimate-builder/skills/app-it/SKILL.md`,
`plugins/ultimate-builder/workflow_contract.json`,
`web/src/lib/guided-agent-routing.ts`. No stored data changes.

Tests and observed results: `tests/tui_gateway/test_studio_context.py` 13
passed (two new: no shell; registry merge), `test_studio_model_routing.py` 7,
`tests/test_toolsets.py` + `test_toolset_distributions.py`,
`plugins/ultimate-builder/tests/test_workflow_contract.py` (new enforced-rule
test), web `guided-agent-routing.test.ts` 19 passed.

Compatibility / restart: restart Lyra and reload Studio. Saved conversations
receive the new directive on their next turn.

Rollback / retained recovery data: revert the commit.

Local commit / authorized push: local commit; push follows the standing release
instruction.
