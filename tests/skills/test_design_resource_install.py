"""Shared design resources must survive real bundled sync and user edits."""

import json
import re
import subprocess
import sys
from pathlib import Path

from tools import skills_sync


def test_fresh_install_resolves_sibling_references_and_preserves_edits(tmp_path, monkeypatch):
    source = Path(__file__).resolve().parents[2] / "skills" / "ui-ux" / "design-quality"
    home = tmp_path / "home"
    installed = home / "skills"
    monkeypatch.setattr(skills_sync, "HERMES_HOME", home)
    monkeypatch.setattr(skills_sync, "SKILLS_DIR", installed)
    monkeypatch.setattr(skills_sync, "MANIFEST_FILE", installed / ".bundled_manifest")
    monkeypatch.setattr(skills_sync, "_get_bundled_dir", lambda: source)
    monkeypatch.setattr(skills_sync, "_build_external_skill_index", lambda: {})
    first = skills_sync.sync_skills(quiet=True)
    assert "a11y-audit" in first["copied"]
    # These are instructional resource links, not implementation source tests.
    instruction = (installed / "a11y-audit" / "SKILL.md").read_text(encoding="utf-8")
    links = re.findall(r"`(\.\./[^` ]+)", instruction)
    assert links
    for link in links:
        assert (installed / "a11y-audit" / link).is_file(), link
    result = subprocess.run(
        [sys.executable, str(installed / "scripts" / "contrast.py"), "#000000", "#ffffff"],
        capture_output=True, text=True, encoding="utf-8", errors="replace", check=True,
    )
    assert "21" in result.stdout
    assert json.loads((installed / "tokens" / "colors.json").read_text(encoding="utf-8"))
    custom = installed / "accessibility" / "wcag-checklist.md"
    custom.write_text("User-owned notes", encoding="utf-8")
    skills_sync.sync_skills(quiet=True)
    assert custom.read_text(encoding="utf-8") == "User-owned notes"
