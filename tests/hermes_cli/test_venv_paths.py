"""The shared venv resolver.

See ``hermes_cli/venv_paths.py`` for the bug this replaces: a hardcoded
``<repo>/venv`` meant a ``.venv`` install could never be probed, so venv
health was permanently *indeterminate* and every launch reprinted a warning
it had no way to resolve.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

from hermes_cli.venv_paths import (
    DEFAULT_VENV_DIR_NAME,
    detect_project_venv_dir,
    project_venv_root,
    venv_python_path,
)


def _make_venv(root: Path, name: str) -> Path:
    venv = root / name
    (venv / "bin").mkdir(parents=True)
    (venv / "bin" / "python").write_text("#!/bin/sh\n")
    return venv


@pytest.fixture(autouse=True)
def no_ambient_venv(monkeypatch):
    """Ignore the venv the test suite itself happens to run in."""
    monkeypatch.delenv("VIRTUAL_ENV", raising=False)
    monkeypatch.setattr(sys, "prefix", sys.base_prefix)


# ---------------------------------------------------------------------------
# venv_python_path
# ---------------------------------------------------------------------------


def test_python_path_posix():
    assert venv_python_path(Path("/p/.venv"), windows=False) == Path(
        "/p/.venv/bin/python"
    )


def test_python_path_windows():
    assert venv_python_path(Path("/p/venv"), windows=True) == Path(
        "/p/venv/Scripts/python.exe"
    )


def test_python_path_accepts_a_string():
    assert venv_python_path("/p/.venv", windows=False) == Path("/p/.venv/bin/python")


# ---------------------------------------------------------------------------
# detect_project_venv_dir
# ---------------------------------------------------------------------------


def test_finds_dot_venv(tmp_path):
    venv = _make_venv(tmp_path, ".venv")
    assert detect_project_venv_dir(tmp_path) == venv.resolve()


def test_finds_plain_venv(tmp_path):
    venv = _make_venv(tmp_path, "venv")
    assert detect_project_venv_dir(tmp_path) == venv.resolve()


def test_dot_venv_wins_when_both_exist(tmp_path):
    dot = _make_venv(tmp_path, ".venv")
    _make_venv(tmp_path, "venv")
    assert detect_project_venv_dir(tmp_path) == dot.resolve()


def test_activated_venv_beats_conventional_names(tmp_path, monkeypatch):
    odd = _make_venv(tmp_path, "env311")
    _make_venv(tmp_path, ".venv")
    monkeypatch.setenv("VIRTUAL_ENV", str(odd))
    assert detect_project_venv_dir(tmp_path) == odd.resolve()


def test_sys_prefix_is_used_when_virtual_env_is_unset(tmp_path, monkeypatch):
    """``.venv/bin/hermes`` sets sys.prefix; nothing exports VIRTUAL_ENV."""
    venv = _make_venv(tmp_path, ".venv")
    monkeypatch.setattr(sys, "prefix", str(venv))
    assert detect_project_venv_dir(tmp_path) == venv.resolve()


def test_venv_outside_the_project_is_rejected(tmp_path, monkeypatch):
    """A pipx or shared venv is not ours to reinstall packages into."""
    project = tmp_path / "project"
    project.mkdir()
    outside = _make_venv(tmp_path, "elsewhere")
    monkeypatch.setenv("VIRTUAL_ENV", str(outside))
    monkeypatch.setattr(sys, "prefix", str(outside))
    assert detect_project_venv_dir(project) is None


def test_stale_virtual_env_pointing_nowhere_falls_through(tmp_path, monkeypatch):
    """A VIRTUAL_ENV left over in the shell must not hide a real venv."""
    venv = _make_venv(tmp_path, ".venv")
    monkeypatch.setenv("VIRTUAL_ENV", str(tmp_path / "deleted-venv"))
    assert detect_project_venv_dir(tmp_path) == venv.resolve()


def test_a_file_named_venv_is_not_a_venv(tmp_path):
    (tmp_path / "venv").write_text("not a directory")
    assert detect_project_venv_dir(tmp_path) is None


def test_nothing_there(tmp_path):
    assert detect_project_venv_dir(tmp_path) is None


# ---------------------------------------------------------------------------
# project_venv_root
# ---------------------------------------------------------------------------


def test_root_returns_the_detected_venv(tmp_path):
    venv = _make_venv(tmp_path, ".venv")
    assert project_venv_root(tmp_path) == venv.resolve()


def test_root_falls_back_to_the_installer_name(tmp_path):
    """Nothing exists yet → the name every installer script creates."""
    assert project_venv_root(tmp_path) == tmp_path / DEFAULT_VENV_DIR_NAME
    assert DEFAULT_VENV_DIR_NAME == "venv"


# ---------------------------------------------------------------------------
# The callers that were silently opting out
# ---------------------------------------------------------------------------


def test_vulnerable_runtime_repair_no_longer_skips_a_dot_venv_install(tmp_path, monkeypatch):
    """``repair_vulnerable_runtime`` looked for ``venv/`` only, so a ``.venv`` install
    fell straight into ``not-applicable`` and the SQLite runtime repair never
    ran there — silently, forever."""
    from hermes_cli import managed_uv

    (tmp_path / "pyproject.toml").write_text("[project]\nname = 'x'\n")
    venv = _make_venv(tmp_path, ".venv")

    probed: list[str] = []

    def _probe(python_path):
        probed.append(str(python_path))
        return None  # "could not probe" — enough to prove we got past the gate

    monkeypatch.setattr(managed_uv, "probe_sqlite_runtime", _probe)

    result = managed_uv.repair_vulnerable_runtime(
        "/opt/bin/uv", project_root=tmp_path
    )

    assert result.status != "not-applicable", result
    assert probed == [str(venv.resolve() / "bin" / "python")]
