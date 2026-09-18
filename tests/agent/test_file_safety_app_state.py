"""Plugin authorization records are read-only to agent file tools.

A preview approval stored under ``<HERMES_HOME>/app-state/`` authorizes
building. If the agent's own file tools could write there, a coordinator could
approve its own checkpoint.
"""

from __future__ import annotations

import json

import pytest


@pytest.fixture()
def profile_home(tmp_path, monkeypatch):
    root = tmp_path / ".hermes"
    profile = root / "profiles" / "work"
    profile.mkdir(parents=True)
    monkeypatch.setenv("HERMES_HOME", str(profile))
    return profile


def test_write_file_tool_cannot_create_an_approval_record(profile_home):
    import tools.file_tools as ft

    target = profile_home / "app-state" / "ultimate-builder" / "preview-checkpoints" / "x.json"

    result = json.loads(ft.write_file_tool(str(target), '{"status": "approve"}'))

    assert "error" in result
    assert not target.exists()


def test_write_file_tool_cannot_overwrite_an_existing_record(profile_home):
    import tools.file_tools as ft

    target = profile_home / "app-state" / "record.json"
    target.parent.mkdir(parents=True)
    target.write_text('{"status": "pending"}', encoding="utf-8")

    result = json.loads(ft.write_file_tool(str(target), '{"status": "approve"}'))

    assert "error" in result
    assert target.read_text(encoding="utf-8") == '{"status": "pending"}'


def test_similarly_named_project_folder_stays_writable(profile_home, tmp_path):
    from agent.file_safety import is_write_denied

    target = tmp_path / "project" / "app-state" / "notes.json"

    assert is_write_denied(str(target)) is False
