from __future__ import annotations

from pathlib import Path

from hermes_cli.external_cli import resolve_external_cli_command


def test_claude_falls_back_to_user_local_bin_when_path_is_narrow(tmp_path, monkeypatch):
    command = tmp_path / ".local" / "bin" / "claude"
    command.parent.mkdir(parents=True)
    command.write_text("#!/bin/sh\n", encoding="utf-8")
    command.chmod(0o755)
    monkeypatch.setattr("hermes_cli.external_cli.Path.home", lambda: tmp_path)
    monkeypatch.setattr("hermes_cli.external_cli.shutil.which", lambda _command: None)

    assert resolve_external_cli_command("claude-cli", "claude") == str(command)


def test_explicit_missing_command_is_not_silently_replaced(tmp_path, monkeypatch):
    fallback = tmp_path / ".local" / "bin" / "claude"
    fallback.parent.mkdir(parents=True)
    fallback.write_text("#!/bin/sh\n", encoding="utf-8")
    fallback.chmod(0o755)
    monkeypatch.setattr("hermes_cli.external_cli.Path.home", lambda: tmp_path)
    monkeypatch.setattr("hermes_cli.external_cli.shutil.which", lambda _command: None)

    configured = tmp_path / "chosen" / "claude"
    assert resolve_external_cli_command("claude-cli", str(configured)) is None


def test_other_external_providers_do_not_borrow_claude_fallback(tmp_path, monkeypatch):
    fallback = tmp_path / ".local" / "bin" / "claude"
    fallback.parent.mkdir(parents=True)
    fallback.write_text("#!/bin/sh\n", encoding="utf-8")
    fallback.chmod(0o755)
    monkeypatch.setattr("hermes_cli.external_cli.Path.home", lambda: tmp_path)
    monkeypatch.setattr("hermes_cli.external_cli.shutil.which", lambda _command: None)

    assert resolve_external_cli_command("copilot-acp", "claude") is None
