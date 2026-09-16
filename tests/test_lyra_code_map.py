"""Inventory tests use fixture inputs, not implementation-source assertions."""

import subprocess

from scripts.lyra_code_map import describe, included, inventory


def test_inventory_lists_tracked_files_only(tmp_path):
    """Untracked scratch files differ per machine and must not enter the index."""
    subprocess.run(["git", "init", "-q", str(tmp_path)], check=True)
    (tmp_path / "tracked.py").write_text('"""Tracked module."""\n', encoding="utf-8")
    (tmp_path / "scratch.py").write_text('"""Local scratch."""\n', encoding="utf-8")
    subprocess.run(["git", "-C", str(tmp_path), "add", "tracked.py"], check=True)
    subprocess.run(
        ["git", "-C", str(tmp_path), "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qm", "init"],
        check=True,
    )

    rows = inventory(tmp_path)

    assert "tracked.py\troot\tTracked module." in rows
    assert "scratch.py" not in rows


def test_inventory_excludes_user_projects_secrets_and_dependencies():
    for path in (
        "my_projects/private/src/app.py",
        "output/report.md",
        ".env",
        "web/node_modules/pkg/a.js",
    ):
        assert not included(path)
    assert included("web/src/pages/ChatPage.tsx")
    assert included("plugins/ultimate-builder/project_runs.py")


def test_summaries_are_bounded_navigation_not_copied_code():
    assert (
        describe("app.py", '"""Owns project status.\nMore detail."""')
        == "Owns project status."
    )
    assert describe("tests/test_status.py").startswith("Behavioral tests:")
    assert (
        describe("hermes_cli/web_dist/app.js", "private bundle text")
        == "Generated asset; edit its source and rebuild"
    )
    assert len(describe("app.py", '"""' + "a" * 1000)) <= 160
