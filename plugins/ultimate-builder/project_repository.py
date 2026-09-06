"""Create and verify project-local Git repositories without touching Lyra Git."""

from __future__ import annotations

import os
import shutil
import subprocess
from pathlib import Path
from typing import Iterable


PROJECT_MARKER = ".lyra-project"
BASELINE_MESSAGE = "chore: initialize Lyra project"
_GIT_TIMEOUT_SECONDS = 15


class ProjectRepositoryError(RuntimeError):
    """The selected folder cannot safely own an isolated project repository."""


def _clean_env() -> dict[str, str]:
    env = os.environ.copy()
    for key in ("GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE", "GIT_NAMESPACE"):
        env.pop(key, None)
    env["GIT_TERMINAL_PROMPT"] = "0"
    return env


def _git(project: Path, *args: str, check: bool = True) -> subprocess.CompletedProcess[str]:
    command = shutil.which("git")
    if not command:
        raise ProjectRepositoryError(
            "Git is required to keep this project separate, but Lyra could not find it."
        )
    try:
        completed = subprocess.run(
            [command, "-C", str(project), *args],
            capture_output=True,
            check=False,
            env=_clean_env(),
            text=True,
            timeout=_GIT_TIMEOUT_SECONDS,
        )
    except (OSError, subprocess.SubprocessError) as exc:
        raise ProjectRepositoryError("Lyra could not check this project's Git repository.") from exc
    if check and completed.returncode != 0:
        detail = (completed.stderr or completed.stdout).strip()
        raise ProjectRepositoryError(detail or "The project Git command did not complete.")
    return completed


def _repository_root(project: Path) -> Path | None:
    result = _git(project, "rev-parse", "--show-toplevel", check=False)
    if result.returncode != 0 or not result.stdout.strip():
        return None
    return Path(result.stdout.strip()).expanduser().resolve(strict=False)


def _inside(path: Path, roots: Iterable[Path]) -> bool:
    return any(path == root or path.is_relative_to(root) for root in roots)


def _verify_lyra_parent_is_clean(project: Path, checkout: Path) -> None:
    """Refuse inherited tracked paths; never repair the parent index implicitly."""
    relative = project.relative_to(checkout).as_posix()
    tracked = _git(checkout, "ls-files", "--", relative, check=False)
    if tracked.stdout.strip():
        raise ProjectRepositoryError(
            "This project is still attached to an older Lyra Git history. "
            "Separate its local history and update Lyra before opening it again; "
            "Lyra will not alter the application repository automatically."
        )
    ignored = _git(checkout, "check-ignore", "-q", "--", relative, check=False)
    if ignored.returncode != 0:
        raise ProjectRepositoryError(
            "This project folder is not excluded from Lyra's application repository. "
            "Update Lyra before continuing."
        )


def _initialize(project: Path) -> None:
    result = _git(project, "init", "-b", "main", check=False)
    if result.returncode == 0:
        return
    _git(project, "init")
    _git(project, "symbolic-ref", "HEAD", "refs/heads/main")


def _ensure_marker_commit(project: Path) -> bool:
    marker = project / PROJECT_MARKER
    if marker.exists() and not marker.is_file():
        raise ProjectRepositoryError(f"{PROJECT_MARKER} must be a regular file.")
    if not marker.exists():
        try:
            marker.write_text("Managed by Lyra\n", encoding="utf-8")
        except OSError as exc:
            raise ProjectRepositoryError("Lyra could not mark this project folder.") from exc

    changed = _git(
        project, "status", "--porcelain=v1", "--", PROJECT_MARKER
    ).stdout.strip()
    if not changed:
        return False
    _git(project, "add", "-f", "--", PROJECT_MARKER)
    _git(
        project,
        "-c",
        "user.name=Lyra",
        "-c",
        "user.email=lyra@local.invalid",
        "commit",
        "--only",
        "--no-verify",
        "--no-gpg-sign",
        "-m",
        BASELINE_MESSAGE,
        "--",
        PROJECT_MARKER,
    )
    return True


def ensure_project_repository(
    path: str | Path,
    *,
    lyra_checkout: str | Path,
    managed_roots: Iterable[str | Path],
) -> dict[str, object]:
    """Ensure the selected folder, not an ancestor, owns all future Git work."""
    project = Path(path).expanduser().resolve(strict=False)
    checkout = Path(lyra_checkout).expanduser().resolve(strict=False)
    roots = tuple(Path(root).expanduser().resolve(strict=False) for root in managed_roots)
    if not project.is_dir():
        raise ProjectRepositoryError("Project directory not found.")

    inherited_root = _repository_root(project)
    checkout_root = _repository_root(checkout) if checkout.is_dir() else None
    if (
        checkout_root == checkout
        and project.is_relative_to(checkout)
        and _inside(project, roots)
    ):
        _verify_lyra_parent_is_clean(project, checkout)

    initialized = inherited_root != project
    if inherited_root and inherited_root != project:
        if inherited_root != checkout:
            raise ProjectRepositoryError(
                "The selected folder is inside another Git project. Open that "
                "repository's top-level folder, or choose a separate project folder."
            )

    git_marker = project / ".git"
    if git_marker.exists() and inherited_root != project:
        raise ProjectRepositoryError("This project contains invalid Git metadata.")
    if initialized:
        _initialize(project)

    root = _repository_root(project)
    if root != project:
        raise ProjectRepositoryError("Lyra could not isolate this project's Git repository.")
    baseline_created = _ensure_marker_commit(project)
    head = _git(project, "rev-parse", "HEAD").stdout.strip()
    remotes = [line for line in _git(project, "remote").stdout.splitlines() if line.strip()]
    return {
        "root": str(root),
        "initialized": initialized,
        "baseline_created": baseline_created,
        "head": head,
        "has_remote": bool(remotes),
    }
