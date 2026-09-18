"""Workers get the ledger format, a repeatable test contract and a lean Personal procedure.

Trial 3's Development worker spent 12 calls searching for the ledger format and
46 calls driving a browser-only test page. These tests check the relationships
that prevent that: the seeded template and example row are what the parser
reads, and real queued jobs carry the guidance their phase and profile need.
"""

from __future__ import annotations

import importlib.util
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]


def _load(name: str):
    spec = importlib.util.spec_from_file_location(f"ub_guidance_test_{name}", ROOT / f"{name}.py")
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)
    return module


@pytest.fixture
def project(tmp_path, monkeypatch):
    monkeypatch.setenv("HERMES_HOME", str(tmp_path / "home"))
    monkeypatch.setenv("HERMES_KANBAN_HOME", str(tmp_path / "board"))
    monkeypatch.delenv("HERMES_KANBAN_TASK", raising=False)
    workspace = tmp_path / "project"
    workspace.mkdir()
    return workspace


def _approve(project: Path) -> None:
    spec = importlib.util.spec_from_file_location(
        "ub_guidance_preview_helper", Path(__file__).with_name("preview_approval.py")
    )
    helper = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(helper)
    helper.approve_preview(project)


# --- the template and the parser agree --------------------------------------

def test_seeded_template_plus_example_row_is_what_the_parser_reads():
    seed = _load("progress_ledger_seed")
    parse = _load("project_progress")._parse_progress_ledger

    assert parse(seed.LEDGER_TEMPLATE)["phases"] == []
    phases = parse(seed.LEDGER_TEMPLATE + seed.LEDGER_EXAMPLE_ROW + "\n")["phases"]

    assert phases[0]["id"] == "sw-developer"
    assert phases[0]["state"] == "now"
    assert phases[0]["evidence"].endswith(".txt")


def test_every_documented_status_word_maps_to_a_distinct_state():
    seed = _load("progress_ledger_seed")
    parse = _load("project_progress")._parse_progress_ledger
    states = set()
    for word in seed.STATUS_WORDS:
        row = f"| Development | {word} | |\n"
        states.add(parse(seed.LEDGER_TEMPLATE + row)["phases"][0]["state"])

    assert states == {"pending", "now", "blocked", "done"}


# --- seeding the project ledger ----------------------------------------------

def test_ledger_is_created_once_and_never_overwritten(tmp_path):
    seed = _load("progress_ledger_seed")

    assert seed.ensure_progress_ledger(tmp_path) is True
    ledger = tmp_path / ".sdlc" / "progress.md"
    ledger.write_text("worker edits", encoding="utf-8")

    assert seed.ensure_progress_ledger(tmp_path) is False
    assert ledger.read_text(encoding="utf-8") == "worker edits"


def test_ledger_is_not_written_through_a_symlinked_sdlc_folder(tmp_path):
    seed = _load("progress_ledger_seed")
    elsewhere = tmp_path / "elsewhere"
    elsewhere.mkdir()
    project = tmp_path / "project"
    project.mkdir()
    (project / ".sdlc").symlink_to(elsewhere, target_is_directory=True)

    assert seed.ensure_progress_ledger(project) is False
    assert not (elsewhere / "progress.md").exists()


# --- guidance reaches the right real jobs -------------------------------------

def test_personal_development_job_carries_ledger_testing_and_personal_guidance(project):
    runs = _load("project_runs")
    _approve(project)

    queued = runs.queue_project_run(project, ["sw-developer"], build_profile="personal")

    with runs.kb.connect_closing() as conn:
        body = runs.kb.get_task(conn, queued["tasks"][0]["task_id"]).body
    assert "| Phase | Status | Evidence |" in body
    assert "Do not search Lyra's installation" in body
    assert "node --test" in body and "Rerun the command after every repair" in body
    assert "Personal project" in body


def test_reusable_development_keeps_its_procedure_without_the_personal_block(project):
    runs = _load("project_runs")
    _approve(project)

    queued = runs.queue_project_run(project, ["sw-developer"], build_profile="reusable")

    with runs.kb.connect_closing() as conn:
        body = runs.kb.get_task(conn, queued["tasks"][0]["task_id"]).body
    assert "Testing contract" in body
    assert "Personal project" not in body


def test_documentation_job_gets_the_ledger_format_but_no_testing_contract(project):
    runs = _load("project_runs")

    queued = runs.queue_project_run(project, ["tech-writer"])

    with runs.kb.connect_closing() as conn:
        body = runs.kb.get_task(conn, queued["tasks"][0]["task_id"]).body
    assert "| Phase | Status | Evidence |" in body
    assert "Testing contract" not in body


def test_queueing_seeds_the_ledger_before_any_worker_starts(project):
    runs = _load("project_runs")

    runs.queue_project_run(project, ["tech-writer"])

    ledger = project / ".sdlc" / "progress.md"
    assert ledger.is_file()
    assert "| Phase | Status | Evidence |" in ledger.read_text(encoding="utf-8")
