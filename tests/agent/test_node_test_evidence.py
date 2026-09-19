"""Plain Node tests reach the same real evidence ledger as manifest projects."""

import shutil
import subprocess

import pytest

from agent.coding_context import detect_project_facts
from agent.verification_evidence import record_terminal_result, verification_status


@pytest.mark.skipif(not shutil.which("node"), reason="requires Node test runner")
def test_real_node_failure_pipeline_and_pass_are_recorded(tmp_path):
    subprocess.run(["git", "init", "-q", str(tmp_path)], check=True)
    folder = tmp_path / "js"
    folder.mkdir()
    test = folder / "calculator.test.cjs"
    test.write_text("require('node:assert/strict').equal(2 + 2, 5);", encoding="utf-8")
    assert detect_project_facts(tmp_path).verify_commands == ["node --test"]
    commands = [("node --test", "failed")]
    if shutil.which("sh") and shutil.which("tail"):
        commands.append(("node --test | tail -1", "unverified"))
    for command, expected in commands:
        result = subprocess.run(command, shell=True, cwd=tmp_path, capture_output=True,
                                text=True, encoding="utf-8", errors="replace")
        record_terminal_result(command=command, cwd=tmp_path, session_id="node",
                               exit_code=result.returncode, output=result.stdout + result.stderr)
        assert verification_status(session_id="node", cwd=tmp_path)["status"] == expected
    test.write_text("require('node:assert/strict').equal(2 + 2, 4);", encoding="utf-8")
    result = subprocess.run(["node", "--test"], cwd=tmp_path, capture_output=True,
                            text=True, encoding="utf-8", errors="replace")
    assert result.returncode == 0
    record_terminal_result(command="node --test", cwd=tmp_path, session_id="node",
                           exit_code=result.returncode, output=result.stdout)
    assert verification_status(session_id="node", cwd=tmp_path)["status"] == "passed"


def test_explicit_package_command_wins_and_typescript_is_not_guessed(tmp_path):
    (tmp_path / "a.test.ts").write_text("", encoding="utf-8")
    assert detect_project_facts(tmp_path).verify_commands == []
    (tmp_path / "a.test.js").write_text("", encoding="utf-8")
    (tmp_path / "package.json").write_text('{"scripts":{"test":"vitest"}}', encoding="utf-8")
    assert detect_project_facts(tmp_path).verify_commands == ["npm run test"]
