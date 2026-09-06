"""Safe discovery for subscription-backed command-line model providers."""

from __future__ import annotations

import os
import shutil
import sys
from pathlib import Path


def _has_path_separator(command: str) -> bool:
    return os.sep in command or (os.altsep is not None and os.altsep in command)


def _claude_install_candidates(home: Path) -> list[Path]:
    """Return trusted Claude installer locations in deterministic order."""
    executable = "claude.exe" if sys.platform == "win32" else "claude"
    candidates = [
        home / ".local" / "bin" / executable,
        home / ".npm-global" / "bin" / executable,
        home / ".volta" / "bin" / executable,
        home / ".bun" / "bin" / executable,
    ]
    if sys.platform == "win32":
        appdata = os.environ.get("APPDATA", "").strip()
        if appdata:
            candidates.extend([
                Path(appdata) / "npm" / "claude.cmd",
                Path(appdata) / "npm" / executable,
            ])
    else:
        candidates.extend([
            Path("/opt/homebrew/bin/claude"),
            Path("/usr/local/bin/claude"),
        ])
        # The official npm install often lands inside the active NVM version.
        # Prefer newer version directories without sourcing an interactive shell.
        candidates.extend(
            sorted(
                (home / ".nvm" / "versions" / "node").glob("*/bin/claude"),
                reverse=True,
            )
        )
    return candidates


def _usable_executable(path: Path) -> bool:
    return path.is_file() and (sys.platform == "win32" or os.access(path, os.X_OK))


def resolve_external_cli_command(provider_id: str, command: str) -> str | None:
    """Resolve an external provider command without scanning arbitrary paths.

    Explicit paths and non-default command names are authoritative. Only the
    default Claude command gets the trusted-location fallback used when a
    desktop/service process inherited a narrower PATH than the user's shell.
    """
    requested = str(command or "").strip()
    if not requested:
        return None

    expanded = os.path.expanduser(requested)
    resolved = shutil.which(expanded)
    if resolved:
        return resolved
    if _has_path_separator(expanded):
        return expanded if _usable_executable(Path(expanded)) else None
    if provider_id != "claude-cli" or requested not in {"claude", "claude-code"}:
        return None

    for candidate in _claude_install_candidates(Path.home()):
        if _usable_executable(candidate):
            return str(candidate)
    return None
