from __future__ import annotations

import importlib.util
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[1]


def load_module():
    path = ROOT / "project_work_units.py"
    spec = importlib.util.spec_from_file_location("project_work_units_test", path)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)
    return module


def test_loads_bounded_units_dependencies_and_latest_evidence(tmp_path):
    (tmp_path / "task-graph.md").write_text(
        """# Plan

### TG-001 — Create the storage adapter
**Depends on:** architecture approval.
**Work:** Add one adapter and its tests.

### TG-002 — Connect the storage route
**Depends on:** TG-001.
**Work:** Connect one route and its tests.
""",
        encoding="utf-8",
    )
    evidence = tmp_path / ".sdlc" / "evidence" / "tasks"
    evidence.mkdir(parents=True)
    (evidence / "TG-001.txt").write_text(
        "First review: REJECTED\nAfter correction: ACCEPTED\n", encoding="utf-8"
    )

    result = load_module().load_development_work_units(tmp_path)

    assert result["source"] == "task-graph.md"
    assert result["units"] == [
        {
            "id": "TG-001",
            "title": "Create the storage adapter",
            "section": "### TG-001 — Create the storage adapter\n"
            "**Depends on:** architecture approval.\n"
            "**Work:** Add one adapter and its tests.",
            "parents": [],
            "accepted": True,
        },
        {
            "id": "TG-002",
            "title": "Connect the storage route",
            "section": "### TG-002 — Connect the storage route\n"
            "**Depends on:** TG-001.\n"
            "**Work:** Connect one route and its tests.",
            "parents": ["TG-001"],
            "accepted": False,
        },
    ]


@pytest.mark.parametrize(
    "markdown, message",
    [
        (
            "### T-001: First\n**Depends on:** T-999\n\n"
            "### T-002: Second\n**Depends on:** T-001\n",
            "unknown task",
        ),
        (
            "### T-001: First\n**Depends on:** T-002\n\n"
            "### T-002: Second\n**Depends on:** T-001\n",
            "dependency cycle",
        ),
        (
            "### T-001: First\n\n### T-001: Repeated\n",
            "repeats work item",
        ),
    ],
)
def test_rejects_unsafe_task_graphs(tmp_path, markdown, message):
    (tmp_path / "task-graph.md").write_text(markdown, encoding="utf-8")
    with pytest.raises(ValueError, match=message):
        load_module().load_development_work_units(tmp_path)


def test_missing_or_single_item_graph_keeps_legacy_single_job_mode(tmp_path):
    module = load_module()
    assert module.load_development_work_units(tmp_path)["units"] == []
    (tmp_path / "task-graph.md").write_text(
        "### T-001: One small fix\n**Depends on:** none\n", encoding="utf-8"
    )
    assert module.load_development_work_units(tmp_path)["units"] == []
