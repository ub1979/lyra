"""Generate a deterministic file inventory for AI-assisted Lyra maintenance."""

from __future__ import annotations

import argparse
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDEX = Path("docs/lyra/file-index.tsv")
EXCLUDED = {
    "my_projects",
    "song-maker-studio",
    "output",
    ".sdlc",
    ".git",
    ".venv",
    "node_modules",
}
GENERATED = ("hermes_cli/web_dist/", "ui-tui/dist/", "apps/desktop/dist/")


def describe(path: str, header: str = "") -> str:
    """Summarize declarations, never copy code or private project content."""
    if "/tests/" in f"/{path}" or ".test." in path or "/__tests__/" in path:
        return "Behavioral tests: " + Path(path).stem.replace("test_", "").replace(
            "_", " "
        )
    if path.startswith(GENERATED):
        return "Generated asset; edit its source and rebuild"
    match = re.match(r'\s*(?:"""|\x27\x27\x27|/\*\*)\s*([^\n]+)', header)
    if match:
        summary = match.group(1).strip().rstrip('"\x27*/ ')
        return re.sub(r"\s+", " ", summary)[:160]
    return f"{Path(path).suffix.lstrip('.') or 'configuration'}: {Path(path).stem.replace('_', ' ').replace('-', ' ')}"


def included(path: str) -> bool:
    parts = Path(path).parts
    return (
        bool(parts)
        and not EXCLUDED.intersection(parts)
        and not any(part.startswith(".env") for part in parts)
    )


def inventory(root: Path) -> str:
    result = subprocess.run(
        [
            "git",
            "-C",
            str(root),
            "ls-files",
            "--cached",
            "--others",
            "--exclude-standard",
            "-z",
        ],
        capture_output=True,
        check=True,
    )
    paths = sorted(set(result.stdout.decode("utf-8").split("\0")))
    rows = ["path\tarea\tsummary"]
    for name in paths:
        if not included(name):
            continue
        path = root / name
        if not path.is_file():
            continue
        header = ""
        if (
            not name.startswith(GENERATED)
            and path.suffix in {".py", ".ts", ".tsx"}
            and not path.is_symlink()
        ):
            with path.open("rb") as stream:
                header = stream.read(2048).decode("utf-8", errors="replace")
        area = name.split("/")[0] if "/" in name else "root"
        rows.append("\t".join((name, area, describe(name, header).strip())).replace("\r", " "))
    return "\n".join(rows) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--check",
        action="store_true",
        help="Fail if the saved index needs regeneration",
    )
    args = parser.parse_args()
    content = inventory(ROOT)
    path = ROOT / INDEX
    if args.check:
        if not path.exists() or path.read_text(encoding="utf-8") != content:
            print("Lyra file index is stale. Run: python scripts/lyra_code_map.py")
            return 1
    else:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")
    print(f"Lyra file index: {len(content.splitlines()) - 1} maintained files")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
