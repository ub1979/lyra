"""The project venv is found by looking, not by assuming it is named ``venv``.

Regression for the loop a ``.venv`` checkout fell into: every venv-aware path
hardcoded ``<repo>/venv``, so ``_resolve_install_target_python`` found no
interpreter, ``_detect_broken_lazy_refresh_imports`` returned *indeterminate*
rather than an answer, ``.lazy-refresh-incomplete`` was never cleared, and
every launch reprinted

    ⚠ A previous lazy-backend refresh may have left the venv unhealthy...
      ⚠ Import probes unavailable — cannot confirm venv package health.

without ever probing anything.
"""

from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import patch

import pytest

from hermes_cli import main as cli_main


def _make_venv(root: Path, name: str) -> Path:
    """Create a venv-shaped directory tree with a POSIX interpreter."""
    venv = root / name
    (venv / "bin").mkdir(parents=True)
    (venv / "bin" / "python").write_text("#!/bin/sh\n")
    return venv


@pytest.fixture
def no_ambient_venv(monkeypatch):
    """Ignore the venv the test suite itself is running in."""
    monkeypatch.delenv("VIRTUAL_ENV", raising=False)
    monkeypatch.setattr(sys, "prefix", sys.base_prefix)


# ---------------------------------------------------------------------------
# _detect_project_venv_dir / _project_venv_root
# ---------------------------------------------------------------------------


def test_dot_venv_is_found(tmp_path, no_ambient_venv):
    venv = _make_venv(tmp_path, ".venv")
    with patch.object(cli_main, "PROJECT_ROOT", tmp_path):
        assert cli_main._project_venv_root() == venv.resolve()


def test_plain_venv_is_still_found(tmp_path, no_ambient_venv):
    venv = _make_venv(tmp_path, "venv")
    with patch.object(cli_main, "PROJECT_ROOT", tmp_path):
        assert cli_main._project_venv_root() == venv.resolve()


def test_dot_venv_wins_when_both_exist(tmp_path, no_ambient_venv):
    dot = _make_venv(tmp_path, ".venv")
    _make_venv(tmp_path, "venv")
    with patch.object(cli_main, "PROJECT_ROOT", tmp_path):
        assert cli_main._project_venv_root() == dot.resolve()


def test_activated_venv_wins_even_with_an_unusual_name(tmp_path, monkeypatch):
    """A venv the user activated is the one we install into, whatever it is called."""
    odd = _make_venv(tmp_path, "env311")
    monkeypatch.setenv("VIRTUAL_ENV", str(odd))
    monkeypatch.setattr(sys, "prefix", sys.base_prefix)
    _make_venv(tmp_path, ".venv")
    with patch.object(cli_main, "PROJECT_ROOT", tmp_path):
        assert cli_main._project_venv_root() == odd.resolve()


def test_venv_outside_the_project_is_ignored(tmp_path, monkeypatch):
    """A pipx/system/shared venv is not ours to reinstall packages into."""
    project = tmp_path / "project"
    project.mkdir()
    outside = _make_venv(tmp_path, "elsewhere")
    monkeypatch.setenv("VIRTUAL_ENV", str(outside))
    monkeypatch.setattr(sys, "prefix", str(outside))
    with patch.object(cli_main, "PROJECT_ROOT", project):
        assert cli_main._detect_project_venv_dir() is None
        # Nothing found → the name every installer script creates.
        assert cli_main._project_venv_root() == project / "venv"


def test_running_interpreter_inside_the_project_counts(tmp_path, monkeypatch):
    """``.venv/bin/hermes`` sets sys.prefix but not always VIRTUAL_ENV."""
    venv = _make_venv(tmp_path, ".venv")
    monkeypatch.delenv("VIRTUAL_ENV", raising=False)
    monkeypatch.setattr(sys, "prefix", str(venv))
    with patch.object(cli_main, "PROJECT_ROOT", tmp_path):
        assert cli_main._project_venv_root() == venv.resolve()


def test_no_venv_at_all_falls_back_to_the_installer_name(tmp_path, no_ambient_venv):
    with patch.object(cli_main, "PROJECT_ROOT", tmp_path):
        assert cli_main._project_venv_root() == tmp_path / "venv"
        assert cli_main._detect_project_venv_dir() is None


def test_a_file_named_venv_is_not_a_venv(tmp_path, no_ambient_venv):
    (tmp_path / "venv").write_text("not a directory")
    with patch.object(cli_main, "PROJECT_ROOT", tmp_path):
        assert cli_main._detect_project_venv_dir() is None


# ---------------------------------------------------------------------------
# The chain that actually broke
# ---------------------------------------------------------------------------


def test_install_target_points_uv_at_the_real_venv(tmp_path, no_ambient_venv):
    venv = _make_venv(tmp_path, ".venv")
    with patch.object(cli_main, "PROJECT_ROOT", tmp_path), patch(
        "hermes_cli.managed_uv.ensure_uv", return_value="/opt/bin/uv"
    ):
        prefix, env = cli_main._default_venv_install_target()
    assert prefix == ["/opt/bin/uv", "pip"]
    assert env is not None
    assert env["VIRTUAL_ENV"] == str(venv.resolve())


def test_probe_interpreter_resolves_so_health_is_not_indeterminate(
    tmp_path, no_ambient_venv
):
    """The whole point: probes can now run, so the marker can be cleared."""
    venv = _make_venv(tmp_path, ".venv")
    with patch.object(cli_main, "PROJECT_ROOT", tmp_path), patch(
        "hermes_cli.managed_uv.ensure_uv", return_value="/opt/bin/uv"
    ), patch.object(cli_main, "_is_windows", return_value=False):
        prefix, env = cli_main._default_venv_install_target()
        resolved = cli_main._resolve_install_target_python(prefix, env)
    assert resolved == venv.resolve() / "bin" / "python"


def test_health_probe_uses_the_dot_venv_interpreter(tmp_path, no_ambient_venv):
    """``_venv_core_imports_healthy`` used to report 'venv python missing' on a
    managed ``.venv`` install because it only ever looked at ``venv/``."""
    venv = _make_venv(tmp_path, ".venv")
    (tmp_path / ".hermes-bootstrap-complete").write_text("done")
    seen: list[str] = []

    class _Result:
        returncode = 0
        stdout = ""
        stderr = ""

    def _fake_run(cmd, *args, **kwargs):
        seen.append(cmd[0])
        return _Result()

    with patch.object(cli_main, "PROJECT_ROOT", tmp_path), patch.object(
        cli_main, "_is_windows", return_value=False
    ), patch.object(cli_main.subprocess, "run", _fake_run):
        healthy, detail = cli_main._venv_core_imports_healthy()

    assert seen == [str(venv.resolve() / "bin" / "python")]
    assert healthy is True, detail
