"""Discover dependency-free Node tests without scanning dependency trees."""

from itertools import islice
from pathlib import Path


def has_builtin_node_tests(root: Path) -> bool:
    """Recognize conventional JS test files in small, common source folders.

    This is a fallback only; explicit package/Makefile test commands win. Do
    not guess TypeScript loaders or traverse node_modules and linked folders.
    """
    for directory in (root, *(root / name for name in ("js", "src", "test", "tests"))):
        if directory.is_symlink() or not directory.is_dir():
            continue
        try:
            for path in islice(directory.iterdir(), 500):
                if (not path.is_symlink() and path.is_file()
                        and path.name.endswith((".test.js", ".test.cjs", ".test.mjs"))):
                    return True
        except OSError:
            continue
    return False
