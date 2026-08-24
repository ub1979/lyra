"""Locate the project's virtual environment instead of assuming its name.

Hermes grew up assuming the venv lived at ``<repo>/venv`` — the name its
installer scripts create. That assumption is baked into a lot of places, and
it is wrong on every checkout that uses ``.venv`` (what ``uv venv`` and most
editors default to) or any other name.

The failure mode is quiet, which is what makes it worth a module of its own.
Nothing crashes: the code looks for ``<repo>/venv/bin/python``, does not find
it, and takes the "I cannot tell" branch. Concretely, on a ``.venv`` install:

* ``_detect_broken_lazy_refresh_imports`` could not run its probe, so venv
  health came back *indeterminate* forever, ``.lazy-refresh-incomplete`` was
  never cleared, and every single launch reprinted "a previous lazy-backend
  refresh may have left the venv unhealthy" without ever checking anything.
* ``managed_uv.repair_runtime`` returned ``not-applicable``, so the SQLite
  runtime repair silently never ran.

One resolver, used everywhere, so a differently-named venv is found rather
than worked around.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

__all__ = [
    "VENV_DIR_NAMES",
    "DEFAULT_VENV_DIR_NAME",
    "detect_project_venv_dir",
    "project_venv_root",
    "venv_python_path",
]

#: Conventional venv directory names, most specific first.
VENV_DIR_NAMES: tuple[str, ...] = (".venv", "venv")

#: What to create when there is no venv yet — the name the installers use.
DEFAULT_VENV_DIR_NAME = "venv"


def venv_python_path(venv_dir: Path | str, *, windows: bool | None = None) -> Path:
    """Path of the interpreter inside *venv_dir* for this platform."""
    win = sys.platform == "win32" if windows is None else windows
    bin_dir = "Scripts" if win else "bin"
    return Path(venv_dir) / bin_dir / ("python.exe" if win else "python")


def _resolved(path: Path) -> Path:
    try:
        return path.resolve()
    except OSError:
        return path


def _is_within(path: Path, root: Path) -> bool:
    return path == root or root in path.parents


def detect_project_venv_dir(project_root: Path | str) -> Path | None:
    """Return the project's venv directory, or ``None`` when there is none.

    Looked for in order of authority:

    1. ``VIRTUAL_ENV`` — a venv the user actually activated. Also covers
       ``uv run``, which sets it without changing ``sys.prefix``.
    2. ``sys.prefix`` when we are running inside a venv — true of
       ``.venv/bin/hermes``, where nothing exported ``VIRTUAL_ENV``.
    3. ``.venv`` then ``venv`` under the project root.

    Only venvs *inside* ``project_root`` are accepted. A pipx install, a
    system Python or a developer's shared venv is not ours to reinstall
    packages into, and treating one as the project venv would let a routine
    repair rewrite an environment the user never pointed us at.
    """
    root = _resolved(Path(project_root))

    candidates: list[Path] = []
    virtual_env = os.environ.get("VIRTUAL_ENV")
    if virtual_env:
        candidates.append(Path(virtual_env))
    if sys.prefix != sys.base_prefix:
        candidates.append(Path(sys.prefix))
    candidates.extend(root / name for name in VENV_DIR_NAMES)

    for candidate in candidates:
        if not candidate.is_dir():
            continue
        resolved = _resolved(candidate)
        if _is_within(resolved, root):
            return resolved
    return None


def project_venv_root(project_root: Path | str) -> Path:
    """The project venv, or where one should be created if none exists."""
    detected = detect_project_venv_dir(project_root)
    if detected is not None:
        return detected
    return Path(project_root) / DEFAULT_VENV_DIR_NAME
