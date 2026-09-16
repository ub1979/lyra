# Coordinator dispatch tool — 2026-09-16

Change / date: give the Studio coordinator a plugin-registered `project_run`
tool for queueing, inspecting and controlling durable project jobs; 16 September
2026.

User problem and reproduction: the coordinator could only start specialist work
by running `hermes project-run …` through the `terminal` tool. That coupling made
`terminal` unremovable, and the same tool let the coordinator do specialist work
itself: one saved project chat held 700 terminal outputs (4.2 MB) out of 7.1 MB
of context. Today the coordinator still shelled out `kanban` status after the
0.19.37 routing directive asked it not to.

In scope / explicitly deferred: new `plugins/ultimate-builder/project_run_tool.py`
registers `project_run` through the existing `PluginContext.register_tool`
mechanism with `toolset="project-guide"`, so the registry merges it into the
coordinator bundle at resolve time with no `toolsets.py` tool-list edit. Actions
`queue | status | pause | resume | stop` wrap the plugin's own
`queue_project_run`, `project_run_state` (+ `summarize_project_run`) and
`control_project_run`; results are bounded to 8 KB. A `check_fn` hides the tool
when `HERMES_KANBAN_TASK` is set or inside a delegated child, mirroring the
kanban tools' gate inversely, so a specialist can never queue more work.
Deferred: contract/classify-change actions (they remain CLI-only), and any
change to the CLI itself.

Acceptance criteria: queue/status/pause/resume round-trip against real SQLite;
bad action, relative workspace and missing phases return JSON errors instead of
raising; a worker process's registry hides the tool; the plugin registers the
tool in the `project-guide` toolset; output never exceeds the cap.

Affected modules and data: `plugins/ultimate-builder/project_run_tool.py` (new),
`plugins/ultimate-builder/__init__.py` (loads and registers it). No stored data
changes.

Tests and observed results: `plugins/ultimate-builder/tests/test_project_run_tool.py`
6 passed; `plugins/ultimate-builder/tests/test_plugin.py` 14 passed.

Compatibility / restart: restart Lyra. Plugin discovery runs at `model_tools`
import, before any tool schema is built, so the coordinator sees the tool from
its first turn.

Rollback / retained recovery data: revert the commit; the CLI path is untouched.

Local commit / authorized push: local commit; push follows the standing release
instruction.
