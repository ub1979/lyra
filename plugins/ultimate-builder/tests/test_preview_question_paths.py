"""Preview copy names real options without changing trusted decision handling."""

import importlib.util
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]


@pytest.mark.parametrize("names", [("minimal",), ("minimal", "colourful"), ()])
def test_question_never_invents_index_and_user_choice_still_authorizes(tmp_path, monkeypatch, names):
    monkeypatch.setenv("HERMES_HOME", str(tmp_path / "profile"))
    project = tmp_path / "project"
    preview = project / ".sdlc/preview"
    preview.mkdir(parents=True)
    options = {}
    for name in names or ("unregistered",):
        (preview / f"{name}.html").write_text(f"<h1>{name}</h1>", encoding="utf-8")
        options[name] = f".sdlc/preview/{name}.html"
    spec = importlib.util.spec_from_file_location("preview_copy_test", ROOT / "preview_authorization.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    checkpoint = module.open_checkpoint(project, "session", options if names else None)
    assert "index.html" not in checkpoint["question"]
    for name in names:
        assert options[name] in checkpoint["question"]
    assert ".sdlc/preview/" in checkpoint["question"]
    answer = f"Approve {names[0]}" if names else "Approve"
    assert module.record_answer(checkpoint["question"], answer, "session") == "approve"
    assert module.development_refusal(project) is None
    # Copy changes did not weaken the digest fence.
    (preview / "new.html").write_text("changed", encoding="utf-8")
    assert "preview changed" in module.development_refusal(project)
