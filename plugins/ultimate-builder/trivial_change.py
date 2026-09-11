"""Conservative Git-diff classifier for change-record exemptions."""

from __future__ import annotations

import io
import re
import subprocess
import tokenize
from pathlib import Path
from typing import Any


_PLAIN_DOC_SUFFIXES = frozenset({".md", ".rst", ".txt"})
_COMMENT_DIRECTIVE = re.compile(
    r"(?:noqa|type\s*:\s*ignore|pyright|mypy|ruff|fmt\s*:|pragma|"
    r"eslint|prettier|istanbul|sourceMappingURL|sourceURL|webpack|vite)",
    re.I,
)
_DOC_CONTROL_TEXT = re.compile(
    r"(?:```|`[^`]+`|https?://|\b(?:must|shall|required|permission|security|"
    r"authentication|authorization|config(?:uration)?|schema|api|command|"
    r"install)\b|\{\{|\}\}|\$\()",
    re.I,
)


def _git(project: Path, *args: str) -> subprocess.CompletedProcess[str]:
    command = ["git", "-C", str(project), *args]
    try:
        return subprocess.run(
            command,
            capture_output=True,
            check=False,
            text=True,
            timeout=10,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        return subprocess.CompletedProcess(command, 124, "", str(exc))


def _changed_diff_lines(diff: str) -> tuple[list[str], list[str]]:
    removed: list[str] = []
    added: list[str] = []
    for line in diff.splitlines():
        if line.startswith("+++") or line.startswith("---"):
            continue
        if line.startswith("+"):
            added.append(line[1:])
        elif line.startswith("-"):
            removed.append(line[1:])
    return removed, added


def _bounded_edit_distance(left: str, right: str, limit: int) -> int:
    if abs(len(left) - len(right)) > limit:
        return limit + 1
    previous = list(range(len(right) + 1))
    for row, left_char in enumerate(left, 1):
        current = [row]
        for column, right_char in enumerate(right, 1):
            current.append(
                min(
                    current[-1] + 1,
                    previous[column] + 1,
                    previous[column - 1] + (left_char != right_char),
                )
            )
        if min(current) > limit:
            return limit + 1
        previous = current
    return previous[-1]


def _tiny_text_correction(
    removed: list[str], added: list[str], *, maximum_edit_distance: int
) -> bool:
    return (
        bool(removed)
        and len(removed) == len(added)
        and all(
            0
            < _bounded_edit_distance(before, after, maximum_edit_distance)
            <= maximum_edit_distance
            for before, after in zip(removed, added)
        )
    )


def _python_comment_only(project: Path, path: str, lines: list[str]) -> bool:
    if any(
        _COMMENT_DIRECTIVE.search(line) or line.lstrip().startswith("#!")
        for line in lines
    ):
        return False
    before = _git(project, "show", f"HEAD:{path}")
    try:
        current = (project / path).read_bytes()
        old = before.stdout.encode("utf-8") if before.returncode == 0 else b""

        def semantic_tokens(source: bytes) -> list[tuple[int, str]]:
            ignored = {
                tokenize.ENCODING,
                tokenize.COMMENT,
                tokenize.NL,
                tokenize.ENDMARKER,
            }
            return [
                (token.type, token.string)
                for token in tokenize.tokenize(io.BytesIO(source).readline)
                if token.type not in ignored
            ]

        return semantic_tokens(old) == semantic_tokens(current)
    except (OSError, SyntaxError, tokenize.TokenError, UnicodeError):
        return False


def _slash_comment_only(lines: list[str], removed: list[str], added: list[str]) -> bool:
    if len(removed) != len(added) or not lines:
        return False
    for line in lines:
        stripped = line.lstrip()
        if not stripped.startswith("//") or stripped.startswith("///"):
            return False
        if _COMMENT_DIRECTIVE.search(stripped):
            return False
    return True


def _documentation_prose(path: Path, lines: list[str], excluded: set[str]) -> bool:
    if ".sdlc" in path.parts or "docs" not in path.parts:
        return False
    if path.suffix.lower() not in _PLAIN_DOC_SUFFIXES or path.name in excluded:
        return False
    return bool(lines) and not any(_DOC_CONTROL_TEXT.search(line) for line in lines)


def _rejection(reason: str, *, changed_lines: int | None = None) -> dict[str, Any]:
    result: dict[str, Any] = {
        "trivial": False,
        "change_record_required": True,
        "reason": reason,
    }
    if changed_lines is not None:
        result["changed_lines"] = changed_lines
    return result


def classify_trivial_change(
    project: str | Path, policy: dict[str, Any]
) -> dict[str, Any]:
    """Conservatively prove a tiny diff cannot change executable behavior."""
    root = Path(project).expanduser().resolve(strict=False)
    status = _git(root, "status", "--porcelain=v1", "-z", "--untracked-files=all")
    if status.returncode != 0:
        return _rejection("not a Git repository")
    entries = [item for item in status.stdout.split("\0") if item]
    paths: list[str] = []
    for entry in entries:
        if len(entry) < 4 or entry[2] != " ":
            return _rejection("unparseable Git state")
        state = entry[:2]
        raw_path = entry[3:]
        if any(char not in {" ", "M"} for char in state) or "M" not in state:
            return _rejection(f"{raw_path} is not a simple modification")
        paths.append(raw_path)
    if not paths:
        return _rejection("no modified files")

    numstat = _git(root, "diff", "--numstat", "HEAD", "--", *paths)
    if numstat.returncode != 0:
        return _rejection("could not inspect diff")
    changed_lines = 0
    for row in numstat.stdout.splitlines():
        fields = row.split("\t", 2)
        if len(fields) != 3:
            return _rejection("unparseable diff statistics")
        added, removed, _ = fields
        if not added.isdigit() or not removed.isdigit():
            return _rejection("binary change")
        changed_lines += int(added) + int(removed)
    if changed_lines > int(policy["maximum_changed_lines"]):
        return _rejection(
            f"{changed_lines} changed lines exceed the trivial limit",
            changed_lines=changed_lines,
        )

    excluded = set(policy["excluded_names"])
    kinds: set[str] = set()
    for raw_path in paths:
        path = Path(raw_path)
        candidate = root / path
        if candidate.is_symlink() or not candidate.is_file():
            return _rejection(f"unsafe path: {raw_path}")
        diff = _git(root, "diff", "--unified=0", "HEAD", "--", raw_path)
        removed, added = _changed_diff_lines(diff.stdout)
        lines = removed + added
        if not _tiny_text_correction(
            removed,
            added,
            maximum_edit_distance=int(policy["maximum_edit_distance_per_line"]),
        ):
            return _rejection(
                f"{raw_path} is more than a tiny text correction",
                changed_lines=changed_lines,
            )
        if _documentation_prose(path, lines, excluded):
            kinds.add("documentation-prose")
        elif path.suffix.lower() == ".py" and _python_comment_only(
            root, raw_path, lines
        ):
            kinds.add("python-comment")
        elif path.suffix.lower() in {
            ".js",
            ".jsx",
            ".ts",
            ".tsx",
        } and _slash_comment_only(lines, removed, added):
            kinds.add("slash-comment")
        else:
            return _rejection(
                f"{raw_path} can affect behavior or project control",
                changed_lines=changed_lines,
            )
    if not kinds.issubset(set(policy["allowed_kinds"])):
        return _rejection(
            "change kind is not enabled by the workflow contract",
            changed_lines=changed_lines,
        )
    return {
        "trivial": True,
        "change_record_required": False,
        "reason": "all changes are tiny corrections to non-executable prose/comments",
        "kinds": sorted(kinds),
        "files": paths,
        "changed_lines": changed_lines,
    }
