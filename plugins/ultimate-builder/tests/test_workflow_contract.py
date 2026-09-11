from __future__ import annotations

import argparse
import importlib.util
import json
import subprocess
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def load_contract_module():
    path = ROOT / "workflow_contract.py"
    spec = importlib.util.spec_from_file_location(
        "ultimate_builder_workflow_contract_test", path
    )
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)
    return module


def load_cli_module():
    path = ROOT / "project_run_cli.py"
    spec = importlib.util.spec_from_file_location(
        "ultimate_builder_workflow_contract_cli_test", path
    )
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)
    return module


def git(project: Path, *args: str) -> None:
    subprocess.run(
        ["git", "-C", str(project), *args], check=True, capture_output=True, text=True
    )


def repository(tmp_path: Path) -> Path:
    project = tmp_path / "project"
    project.mkdir()
    git(project, "init", "-q")
    git(project, "config", "user.name", "Lyra Test")
    git(project, "config", "user.email", "lyra@example.invalid")
    return project


def commit_all(project: Path) -> None:
    git(project, "add", ".")
    git(project, "commit", "-qm", "fixture")


def test_contract_reports_its_boundary_and_validates_real_evidence():
    report = load_contract_module().contract_report()

    assert report["ok"] is True
    assert report["contract_version"] == "1.0.0"
    assert report["enforced"] > 0
    assert report["exhorted"] > 0
    assert report["declared_rules"] == report["enforced"] + report["exhorted"]
    assert report["enforced_ratio"] == round(
        report["enforced"] / report["declared_rules"], 4
    )
    assert "declared critical workflow rules" in report["note"]


def test_contract_report_is_exposed_through_project_run_cli(capsys):
    cli = load_cli_module()
    parser = argparse.ArgumentParser()
    cli.setup_parser(parser)

    cli.handle(parser.parse_args(["contract"]))

    report = json.loads(capsys.readouterr().out)
    assert report["ok"] is True
    assert report["declared_rules"] == report["enforced"] + report["exhorted"]


def test_contract_rejects_missing_evidence_and_foreign_runtime_terms(tmp_path):
    module = load_contract_module()
    repo = tmp_path / "repo"
    plugin = repo / "plugin"
    skill = plugin / "skills" / "worker" / "SKILL.md"
    skill.parent.mkdir(parents=True)
    skill.write_text("Use OLD_TOOL here.\n", encoding="utf-8")
    contract = {
        "schema_version": 1,
        "contract_version": "1.0.0",
        "rules": [
            {
                "id": "missing",
                "summary": "Missing proof is invalid.",
                "mode": "enforced",
                "evidence": ["does-not-exist.py"],
            }
        ],
        "tool_contract": {"forbidden_playbook_terms": ["OLD_TOOL"]},
    }

    errors = module.validate_contract(
        contract, repository_root=repo, plugin_root=plugin
    )

    assert any("missing rule evidence" in error for error in errors)
    assert any("foreign-runtime term" in error for error in errors)


def test_legacy_debug_learning_is_imported_once_and_original_is_retained(tmp_path):
    module = load_contract_module()
    project = tmp_path / "project"
    sdlc = project / ".sdlc"
    sdlc.mkdir(parents=True)
    legacy = sdlc / "debug-learnings.jsonl"
    legacy.write_text(
        json.dumps({
            "date": "2026-09-11",
            "bug": "Reconnect could lose the answer",
            "root_cause": "The request id was not fenced",
            "pattern": "state-corruption",
            "files": ["src/chat.ts"],
            "trigger": "Reconnect while answering",
            "fix": "Fence replies by request id",
            "lesson": "Test delayed replies after reconnect",
        })
        + "\nnot-json\n",
        encoding="utf-8",
    )

    first = module.reconcile_legacy_debug_learnings(project)
    original = legacy.read_text(encoding="utf-8")
    second = module.reconcile_legacy_debug_learnings(project)
    records = [
        json.loads(line)
        for line in (sdlc / "learnings.jsonl").read_text(encoding="utf-8").splitlines()
    ]

    assert first == {
        "ok": True,
        "imported": 1,
        "skipped": 1,
        "legacy": True,
        "canonical": ".sdlc/learnings.jsonl",
        "legacy_retained": ".sdlc/debug-learnings.jsonl",
    }
    assert second["imported"] == 0
    assert len(records) == 1
    assert records[0]["category"] == "pitfall"
    assert records[0]["source"] == ".sdlc/debug-learnings.jsonl"
    assert legacy.read_text(encoding="utf-8") == original


def test_legacy_learning_reconciliation_serializes_concurrent_queue_preflight(tmp_path):
    module = load_contract_module()
    project = tmp_path / "project"
    sdlc = project / ".sdlc"
    sdlc.mkdir(parents=True)
    (sdlc / "debug-learnings.jsonl").write_text(
        '{"bug":"one race","lesson":"serialize migration"}\n',
        encoding="utf-8",
    )

    with ThreadPoolExecutor(max_workers=8) as pool:
        results = list(pool.map(module.reconcile_legacy_debug_learnings, [project] * 8))

    records = (sdlc / "learnings.jsonl").read_text(encoding="utf-8").splitlines()
    assert sum(result["imported"] for result in results) == 1
    assert len(records) == 1
    assert not (sdlc / ".learning-reconcile.lock").exists()


def test_trivial_classifier_accepts_only_small_non_executable_edits(tmp_path):
    module = load_contract_module()
    project = repository(tmp_path)
    docs = project / "docs"
    docs.mkdir()
    guide = docs / "guide.md"
    python = project / "worker.py"
    typescript = project / "view.ts"
    guide.write_text("A friendly welcom message.\n", encoding="utf-8")
    python.write_text("# A friendly welcom message.\nVALUE = 1\n", encoding="utf-8")
    typescript.write_text(
        "// A friendly welcom message.\nexport const value = 1\n", encoding="utf-8"
    )
    commit_all(project)

    guide.write_text("A friendly welcome message.\n", encoding="utf-8")
    result = module.classify_trivial_change(project)
    assert result["trivial"] is True
    assert result["kinds"] == ["documentation-prose"]

    git(project, "checkout", "--", "docs/guide.md")
    python.write_text("# A friendly welcome message.\nVALUE = 1\n", encoding="utf-8")
    result = module.classify_trivial_change(project)
    assert result["trivial"] is True
    assert result["kinds"] == ["python-comment"]

    git(project, "checkout", "--", "worker.py")
    typescript.write_text(
        "// A friendly welcome message.\nexport const value = 1\n", encoding="utf-8"
    )
    result = module.classify_trivial_change(project)
    assert result["trivial"] is True
    assert result["kinds"] == ["slash-comment"]


def test_trivial_classifier_rejects_behavior_directives_and_untracked_files(tmp_path):
    module = load_contract_module()
    project = repository(tmp_path)
    python = project / "worker.py"
    python.write_text("# noqa: E501\nVALUE = 1\n", encoding="utf-8")
    commit_all(project)

    python.write_text("# note\nVALUE = 2\n", encoding="utf-8")
    assert module.classify_trivial_change(project)["trivial"] is False

    git(project, "checkout", "--", "worker.py")
    python.write_text("# noqa: E502\nVALUE = 1\n", encoding="utf-8")
    assert module.classify_trivial_change(project)["trivial"] is False

    git(project, "checkout", "--", "worker.py")
    (project / "new.txt").write_text("plain text\n", encoding="utf-8")
    assert module.classify_trivial_change(project)["trivial"] is False


def test_trivial_classifier_rejects_substantive_documentation_rewrite(tmp_path):
    module = load_contract_module()
    project = repository(tmp_path)
    docs = project / "docs"
    docs.mkdir()
    guide = docs / "guide.md"
    guide.write_text("Choose the blue theme.\n", encoding="utf-8")
    commit_all(project)

    guide.write_text("Choose the orange theme.\n", encoding="utf-8")

    result = module.classify_trivial_change(project)
    assert result["trivial"] is False
    assert result["change_record_required"] is True


def test_trivial_classifier_rejects_control_document_correction(tmp_path):
    module = load_contract_module()
    project = repository(tmp_path)
    docs = project / "docs"
    docs.mkdir()
    readme = docs / "README.md"
    readme.write_text("A friendly welcom message.\n", encoding="utf-8")
    commit_all(project)

    readme.write_text("A friendly welcome message.\n", encoding="utf-8")

    result = module.classify_trivial_change(project)
    assert result["trivial"] is False
    assert result["change_record_required"] is True
