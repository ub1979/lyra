from __future__ import annotations

import importlib.util
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def load_plugin_api():
    path = ROOT / "dashboard" / "plugin_api.py"
    spec = importlib.util.spec_from_file_location("ultimate_builder_plugin_api", path)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)
    return module


def test_workspace_safety_protects_lyra_source_and_allows_project_area(tmp_path):
    module = load_plugin_api()

    checkout = module._workspace_safety(str(module._LYRA_CHECKOUT))
    tracked_child = module._workspace_safety(
        str(module._LYRA_CHECKOUT / "plugins" / "ultimate-builder")
    )
    project = module._workspace_safety(
        str(module._LYRA_CHECKOUT / "my_projects" / "task-manager")
    )
    external = module._workspace_safety(str(tmp_path / "external-project"))

    assert checkout["protected"] is True
    assert tracked_child["protected"] is True
    assert project["allowed"] is True
    assert external["allowed"] is True


def test_workspace_safety_supports_new_nonexistent_projects():
    module = load_plugin_api()
    result = module.workspace_safety(
        str(module._LYRA_CHECKOUT / "my_projects" / "not-created-yet")
    )
    assert result["allowed"] is True
    assert result["path"].endswith("not-created-yet")


def test_progress_ledger_is_the_structured_phase_source_of_truth():
    module = load_plugin_api()
    result = module._parse_progress_ledger(
        """# Progress

| Phase | Status | Evidence |
|---|---|---|
| Requirements | Complete | approved |
| Architecture | In progress | plan.md |
| Development R01-R10 | Complete for Wave A | tests pass |
| Roadmap R11-R48 | Not started | later |
| Release/signing/notarization | Blocked | certificate missing |
"""
    )

    assert result["available"] is True
    assert [(phase["id"], phase["state"]) for phase in result["phases"]] == [
        ("req-engineer", "done"),
        ("sw-architect", "now"),
        ("sw-developer", "done"),
        ("ledger:roadmap-r11-r48", "pending"),
        ("devops-engineer", "blocked"),
    ]


def test_progress_ledger_without_a_phase_table_is_unavailable():
    module = load_plugin_api()
    result = module._parse_progress_ledger("# Progress\nNo ledger yet.\n")
    assert result == {
        "available": False,
        "source": ".sdlc/progress.md",
        "phases": [],
    }


def test_saved_project_jobs_override_stale_progress_claims():
    module = load_plugin_api()
    ledger = module._parse_progress_ledger(
        """| Phase | Status | Evidence |
|---|---|---|
| Architecture | In progress | plan.md |
| Development | In progress | source |
"""
    )
    merged = module._merge_project_run_state(
        ledger,
        {
            "available": True,
            "tasks": [
                {
                    "phase": "sw-architect",
                    "label": "Architecture",
                    "status": "blocked",
                }
            ],
        },
    )

    assert merged["source"] == "durable-project-jobs"
    assert [(phase["id"], phase["state"]) for phase in merged["phases"]] == [
        ("sw-architect", "blocked"),
        ("sw-developer", "blocked"),
    ]
