from __future__ import annotations

import importlib.util
from pathlib import Path

import pytest
from fastapi import HTTPException


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


class _IdleProjectRuns:
    @staticmethod
    def project_run_state(_project):
        return {"active": False}

    @staticmethod
    def control_project_run(_project, _action):
        return {"ok": True}

    @staticmethod
    def relocate_project_runs(_source, _destination):
        return {"ok": True}


def test_register_and_move_project_without_overwriting(tmp_path, monkeypatch):
    module = load_plugin_api()
    source_parent = tmp_path / "source"
    destination_parent = tmp_path / "destination"
    project = source_parent / "music-app"
    project.mkdir(parents=True)
    destination_parent.mkdir()
    monkeypatch.setattr(module, "_project_runs_module", lambda: _IdleProjectRuns)
    monkeypatch.setattr(module, "_relocate_saved_sessions", lambda *_args: 0)

    registered = module.register_project(
        module.ProjectRegisterRequest(workspace=str(project))
    )
    moved = module.move_project(
        module.ProjectMoveRequest(
            source=str(project), destination_parent=str(destination_parent)
        )
    )

    destination = destination_parent / "music-app"
    assert registered["ok"] is True
    assert moved["destination"] == str(destination)
    assert not project.exists()
    assert (destination / module._PROJECT_MARKER).is_file()

    project = source_parent / "music-app"
    project.mkdir(parents=True)
    (project / module._PROJECT_MARKER).write_text("Managed by Lyra\n")
    with pytest.raises(HTTPException, match="already exists") as error:
        module.move_project(
            module.ProjectMoveRequest(
                source=str(project), destination_parent=str(destination_parent)
            )
        )
    assert error.value.status_code == 409


def test_project_actions_reject_unverified_folder(tmp_path):
    module = load_plugin_api()
    project = tmp_path / "ordinary-folder"
    project.mkdir()

    with pytest.raises(HTTPException, match="cannot verify") as error:
        module._managed_project(str(project))

    assert error.value.status_code == 403


def test_move_refuses_while_project_worker_is_active(tmp_path, monkeypatch):
    module = load_plugin_api()
    project = tmp_path / "working-project"
    destination = tmp_path / "destination"
    project.mkdir()
    destination.mkdir()
    (project / module._PROJECT_MARKER).write_text("Managed by Lyra\n")

    class ActiveProjectRuns(_IdleProjectRuns):
        @staticmethod
        def project_run_state(_project):
            return {"active": True}

    monkeypatch.setattr(module, "_project_runs_module", lambda: ActiveProjectRuns)

    with pytest.raises(HTTPException, match="still working") as error:
        module.move_project(
            module.ProjectMoveRequest(
                source=str(project), destination_parent=str(destination)
            )
        )

    assert error.value.status_code == 409
    assert project.is_dir()


def test_delete_moves_project_to_recoverable_lyra_trash(tmp_path, monkeypatch):
    module = load_plugin_api()
    project = tmp_path / "old-project"
    project.mkdir()
    (project / module._PROJECT_MARKER).write_text("Managed by Lyra\n")
    trash = tmp_path / "lyra-trash"
    monkeypatch.setattr(module, "_project_runs_module", lambda: _IdleProjectRuns)
    monkeypatch.setattr(module, "_relocate_saved_sessions", lambda *_args: 0)
    monkeypatch.setattr(module, "_project_trash_root", lambda: trash)

    result = module.delete_project(
        module.ProjectDeleteRequest(workspace=str(project))
    )

    trashed = Path(result["trash_path"])
    assert result["message"].startswith("Project moved to Lyra Trash")
    assert not project.exists()
    assert trashed.parent == trash
    assert (trashed / module._PROJECT_MARKER).is_file()
