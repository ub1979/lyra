"""`hermes desktop` finds the packaged app under the name electron-builder used.

The rebrand set ``build.executableName`` to ``Lyra`` while the launcher kept
looking for ``Hermes``; the lookup now reads the configured name and keeps the
old one as a fallback for trees packaged before the rename.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

from hermes_cli.main import _desktop_executable_names, _desktop_packaged_executable


def _desktop_dir(tmp_path: Path, executable: str | None = "Lyra") -> Path:
    desktop = tmp_path / "apps" / "desktop"
    desktop.mkdir(parents=True)
    if executable is not None:
        pkg = {"name": "hermes", "productName": executable, "build": {"executableName": executable}}
        (desktop / "package.json").write_text(json.dumps(pkg), encoding="utf-8")
    return desktop


def _touch(path: Path) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(b"binary")
    return path


def test_configured_name_comes_first_and_legacy_name_stays(tmp_path, monkeypatch):
    monkeypatch.setattr(sys, "platform", "linux")
    names = _desktop_executable_names(_desktop_dir(tmp_path))
    assert names[:2] == ["Lyra", "Hermes"]
    assert "lyra" in names and "hermes" in names


def test_missing_package_json_falls_back_to_legacy_name(tmp_path, monkeypatch):
    monkeypatch.setattr(sys, "platform", "win32")
    assert _desktop_executable_names(_desktop_dir(tmp_path, executable=None)) == ["Hermes"]


@pytest.mark.parametrize(
    "platform,relative",
    [
        ("linux", Path("linux-unpacked") / "Lyra"),
        ("win32", Path("win-unpacked") / "Lyra.exe"),
        ("darwin", Path("mac-arm64") / "Lyra.app" / "Contents" / "MacOS" / "Lyra"),
    ],
)
def test_finds_the_renamed_executable_on_every_platform(tmp_path, monkeypatch, platform, relative):
    monkeypatch.setattr(sys, "platform", platform)
    desktop = _desktop_dir(tmp_path)
    binary = _touch(desktop / "release" / relative)
    assert _desktop_packaged_executable(desktop) == binary


def test_pre_rebrand_tree_still_launches(tmp_path, monkeypatch):
    monkeypatch.setattr(sys, "platform", "linux")
    desktop = _desktop_dir(tmp_path)
    legacy = _touch(desktop / "release" / "linux-unpacked" / "hermes")
    found = _desktop_packaged_executable(desktop)
    # samefile, not ==: on a case-insensitive filesystem the lookup may report
    # the "Hermes" spelling for the same file.
    assert found is not None and found.samefile(legacy)


def test_nothing_packaged_returns_none(tmp_path, monkeypatch):
    monkeypatch.setattr(sys, "platform", "linux")
    assert _desktop_packaged_executable(_desktop_dir(tmp_path)) is None
