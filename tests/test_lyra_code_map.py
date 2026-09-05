"""Inventory tests use fixture inputs, not implementation-source assertions."""

from scripts.lyra_code_map import describe, included


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
