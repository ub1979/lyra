"""Exercise discovery in a temporary repo; do not inspect runner source text."""

from pathlib import Path

from scripts import run_tests_parallel as runner


def test_default_discovery_includes_builder_regressions(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    expected = [
        Path("tests/test_core.py"),
        Path("plugins/ultimate-builder/tests/test_builder.py"),
    ]
    for path in expected:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.touch()
    discovered = {
        path.resolve()
        for path in runner._discover_files([
            Path(root) for root in runner._DEFAULT_ROOTS
        ])
    }
    assert {path.resolve() for path in expected}.issubset(discovered)
