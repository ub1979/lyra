"""Development starts only after the user's own preview decision.

Regression for Trial 3: the coordinator wrote the preview and queued
Development in the same turn as a requirements approval, then told the user
"Preview approved". These tests use the real store, digest, clarify tool,
plugin hook and SQLite job queue.
"""

from __future__ import annotations

import importlib.util
import json
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]


def _load(name: str):
    spec = importlib.util.spec_from_file_location(f"ub_preview_test_{name}", ROOT / f"{name}.py")
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)
    return module


@pytest.fixture
def project(tmp_path, monkeypatch):
    monkeypatch.setenv("HERMES_HOME", str(tmp_path / "home"))
    monkeypatch.setenv("HERMES_KANBAN_HOME", str(tmp_path / "board"))
    monkeypatch.delenv("HERMES_KANBAN_TASK", raising=False)
    workspace = tmp_path / "project"
    (workspace / ".sdlc" / "preview").mkdir(parents=True)
    (workspace / ".sdlc" / "preview" / "index.html").write_text("<h1>Tasks</h1>", encoding="utf-8")
    return workspace


def _answer_through_clarify(question: str, choices: list[str], user_answer: str, session_id: str):
    """Run the real clarify tool with a user answer and feed its result to the real hook."""
    from tools.clarify_tool import clarify_tool

    result = clarify_tool(question, choices, callback=lambda _q, _c: user_answer)
    authorization = _load("preview_authorization")
    hook = _load("preview_clarify_hook").make_preview_clarify_hook(authorization.record_answer)
    hook(tool_name="clarify", args={"question": "model text"}, result=result, session_id=session_id)
    return authorization


# --- digest -----------------------------------------------------------------

def test_user_selected_design_reaches_real_worker_body(project):
    for name in ("light", "dark"):
        (project / ".sdlc" / "preview" / f"{name}.html").write_text(name, encoding="utf-8")
    tool = _load("project_run_tool").project_run_tool
    options = {"Look A": ".sdlc/preview/light.html", "Look B": ".sdlc/preview/dark.html"}
    checkpoint = json.loads(tool({"action": "preview", "workspace": str(project),
                                  "preview_options": options}, session_id="chosen"))
    authorization = _answer_through_clarify(
        checkpoint["question"], checkpoint["choices"], "Approve Look A", "chosen"
    )
    assert authorization.development_refusal(project) is None
    queued = json.loads(tool({"action": "queue", "workspace": str(project),
                              "phases": "sw-developer", "build_profile": "personal"}))
    runs = _load("project_runs")
    with runs.kb.connect_closing() as conn:
        body = runs.kb.get_task(conn, queued["tasks"][0]["task_id"]).body
    assert '"selected_preview": ".sdlc/preview/light.html"' in body
    assert '"user_answer": "Approve Look A"' in body
    assert "Do not search conversation history" in body


def test_ambiguous_design_choice_does_not_authorize_queue(project):
    auth = _load("preview_authorization")
    (project / ".sdlc" / "preview" / "other.html").write_text("Other", encoding="utf-8")
    checkpoint = auth.open_checkpoint(project, "s", {
        "A": ".sdlc/preview/index.html", "B": ".sdlc/preview/other.html",
    })
    assert auth.record_answer(checkpoint["question"], "Approve", "s") == "unclear"
    assert auth.development_refusal(project)


def test_preview_option_cannot_escape_digest_directory(project):
    outside = project / "requirements.md"
    outside.write_text("Not previewed", encoding="utf-8")
    with pytest.raises(ValueError, match="inside .sdlc/preview"):
        _load("preview_authorization").open_checkpoint(project, "s", {"A": "requirements.md"})


def test_more_designs_than_buttons_keeps_skip_and_typed_selection(project):
    from tools.clarify_tool import MAX_CHOICES

    options = {}
    for index in range(MAX_CHOICES + 1):
        path = f".sdlc/preview/design-{index}.html"
        (project / path).write_text(str(index), encoding="utf-8")
        options[f"Look {index}"] = path
    auth = _load("preview_authorization")
    checkpoint = auth.open_checkpoint(project, "s", options)
    assert len(checkpoint["choices"]) <= MAX_CHOICES
    assert checkpoint["choices"][-2:] == ["Change", "Skip"]
    _answer_through_clarify(checkpoint["question"], checkpoint["choices"],
                           f"Approve Look {MAX_CHOICES}", "s")
    record = _load("preview_checkpoint_store").load_checkpoint(project)
    assert record["selected_preview"] == options[f"Look {MAX_CHOICES}"]
    assert auth.development_refusal(project) is None

def test_digest_changes_when_any_preview_file_changes(project):
    digest = _load("preview_digest").preview_digest
    first = digest(project)
    (project / ".sdlc" / "preview" / "states.html").write_text("<p>empty</p>", encoding="utf-8")
    second = digest(project)
    (project / ".sdlc" / "preview" / "index.html").write_text("<h1>Edited</h1>", encoding="utf-8")

    assert first and second and first != second != digest(project)


def test_digest_is_none_without_preview_files(tmp_path):
    assert _load("preview_digest").preview_digest(tmp_path) is None


def test_oversized_preview_cannot_reuse_an_approval(project):
    authorization = _load("preview_authorization")
    checkpoint = authorization.open_checkpoint(project, "s")
    authorization.record_answer(checkpoint["question"], "Approve", "s")
    for i in range(200):
        (project / ".sdlc" / "preview" / f"asset-{i}.txt").write_text("asset", encoding="utf-8")
    with pytest.raises(ValueError, match="at most 200 files"):
        authorization.development_refusal(project)


@pytest.mark.parametrize("linked", ["asset", "directory", "root", "sdlc"])
def test_linked_preview_content_is_not_silently_excluded(project, tmp_path, linked):
    digest = _load("preview_digest").preview_digest
    root = project / ".sdlc" / "preview"
    target = tmp_path / "external"
    target.mkdir()
    (target / "index.html").write_text("linked", encoding="utf-8")
    if linked == "asset":
        (root / "linked.html").symlink_to(target / "index.html")
    elif linked == "directory":
        (root / "assets").symlink_to(target, target_is_directory=True)
    else:
        source = root if linked == "root" else root.parent
        saved = tmp_path / "saved-preview"
        source.rename(saved)
        source.symlink_to(saved, target_is_directory=True)
    with pytest.raises(ValueError, match="symlinks"):
        digest(project)


# --- answer classification -------------------------------------------------

@pytest.mark.parametrize(("answer", "expected"), [
    ("Approve", "approve"), ("approved!", "approve"), ("approve it", "approve"),
    ("Skip", "skip"), ("Start building", "skip"),
    ("Change", "change"), ("change the header colour", "change"),
    ("Make a preview first", "change"),
    ("approve, but change the colours", "unclear"),
    ("don't approve yet", "unclear"), ("looks fine I guess", "unclear"), ("", "unclear"),
])
def test_only_clear_answers_approve_or_skip(answer, expected):
    assert _load("preview_answer").classify_preview_answer(answer) == expected


# --- checkpoint lifecycle ---------------------------------------------------

def test_button_answer_through_clarify_authorizes_current_preview(project):
    authorization = _load("preview_authorization")
    checkpoint = authorization.open_checkpoint(project, "session-1")

    authorization = _answer_through_clarify(
        checkpoint["question"], checkpoint["choices"], "Approve", "session-1"
    )

    assert authorization.development_refusal(project) is None


def test_typed_skip_through_clarify_authorizes(project):
    authorization = _load("preview_authorization")
    checkpoint = authorization.open_checkpoint(project, "session-1")

    authorization = _answer_through_clarify(
        checkpoint["question"], checkpoint["choices"], "skip", "session-1"
    )

    assert authorization.development_refusal(project) is None


def test_no_checkpoint_pending_answer_change_and_unclear_all_refuse(project):
    authorization = _load("preview_authorization")
    assert "preview decision" in authorization.development_refusal(project)

    checkpoint = authorization.open_checkpoint(project, "s")
    assert "not answered" in authorization.development_refusal(project)

    authorization.record_answer(checkpoint["question"], "Change", "s")
    assert "changes" in authorization.development_refusal(project)

    checkpoint = authorization.open_checkpoint(project, "s")
    authorization.record_answer(checkpoint["question"], "hmm, maybe", "s")
    assert "unclear" in authorization.development_refusal(project)


def test_preview_edited_after_approval_needs_a_new_decision(project):
    authorization = _load("preview_authorization")
    checkpoint = authorization.open_checkpoint(project, "s")
    authorization.record_answer(checkpoint["question"], "Approve", "s")
    (project / ".sdlc" / "preview" / "index.html").write_text("<h1>Other</h1>", encoding="utf-8")

    assert "changed after" in authorization.development_refusal(project)


def test_answer_from_another_session_or_old_question_is_ignored(project):
    authorization = _load("preview_authorization")
    old = authorization.open_checkpoint(project, "session-1")
    assert authorization.record_answer(old["question"], "Approve", "session-2") is None

    authorization.open_checkpoint(project, "session-1")
    assert authorization.record_answer(old["question"], "Approve", "session-1") is None
    assert authorization.development_refusal(project) is not None


def test_model_written_workspace_marker_does_not_authorize(project):
    authorization = _load("preview_authorization")
    (project / ".sdlc" / "preview-approved").write_text("approved", encoding="utf-8")
    (project / ".sdlc" / "progress.md").write_text("Preview: approved", encoding="utf-8")

    assert authorization.development_refusal(project) is not None


def test_project_without_preview_needs_user_to_choose_building_without_one(tmp_path, monkeypatch):
    monkeypatch.setenv("HERMES_HOME", str(tmp_path / "home"))
    authorization = _load("preview_authorization")
    checkpoint = authorization.open_checkpoint(tmp_path, "s")

    assert "Start building" in checkpoint["choices"]
    assert authorization.development_refusal(tmp_path) is not None
    authorization.record_answer(checkpoint["question"], "Start building", "s")
    assert authorization.development_refusal(tmp_path) is None


def test_hook_ignores_other_tools_and_malformed_results(project):
    authorization = _load("preview_authorization")
    checkpoint = authorization.open_checkpoint(project, "s")
    hook = _load("preview_clarify_hook").make_preview_clarify_hook(authorization.record_answer)

    hook(tool_name="write_file", result=json.dumps(
        {"question": checkpoint["question"], "user_response": "Approve"}), session_id="s")
    hook(tool_name="clarify", result="not json", session_id="s")

    assert "not answered" in authorization.development_refusal(project)


# --- queue boundary -----------------------------------------------------------

def test_trial_3_sequence_is_refused_before_any_job_exists(project):
    runs = _load("project_runs")

    with pytest.raises(PermissionError, match="preview decision"):
        runs.queue_project_run(project, ["sw-developer"], build_profile="personal")

    assert runs._project_tasks(project) == []


def test_tool_and_cli_share_the_refusal(project, capsys):
    tool = _load("project_run_tool")
    result = json.loads(tool.project_run_tool(
        {"action": "queue", "workspace": str(project), "phases": "sw-developer"}
    ))
    assert result["ok"] is False and "preview" in result["error"]

    cli = _load("project_run_cli")
    parser = __import__("argparse").ArgumentParser()
    cli.setup_parser(parser)
    args = parser.parse_args(["queue", "--workspace", str(project), "--phases", "sw-developer"])
    with pytest.raises(PermissionError, match="preview"):
        cli.handle(args)


def test_preview_action_then_user_answer_allows_queueing(project):
    tool = _load("project_run_tool")
    opened = json.loads(tool.project_run_tool(
        {"action": "preview", "workspace": str(project)}, session_id="session-1"
    ))
    _answer_through_clarify(opened["question"], opened["choices"], "Approve", "session-1")

    queued = json.loads(tool.project_run_tool(
        {"action": "queue", "workspace": str(project), "phases": "sw-developer"}
    ))

    assert queued["tasks"][0]["task_id"]


def test_existing_development_and_later_phases_are_not_gated(project):
    runs = _load("project_runs")
    authorization = _load("preview_authorization")
    checkpoint = authorization.open_checkpoint(project, "s")
    authorization.record_answer(checkpoint["question"], "Approve", "s")
    runs.queue_project_run(project, ["sw-developer"])
    # The preview changes later; resumed Development and QA must still queue.
    (project / ".sdlc" / "preview" / "index.html").write_text("<h1>Later</h1>", encoding="utf-8")

    again = runs.queue_project_run(project, ["sw-developer"])
    qa = runs.queue_project_run(project, ["qa-engineer"], build_profile="personal")

    assert again["tasks"] and qa["tasks"]


def test_plugin_registers_the_answer_hook():
    plugin = _load("__init__")
    registered: dict[str, list] = {}

    class Ctx:
        def __getattr__(self, name):
            return lambda *a, **k: None

        def register_hook(self, name, callback):
            registered.setdefault(name, []).append(callback)

    plugin.register(Ctx())

    assert len(registered.get("post_tool_call", [])) == 1
