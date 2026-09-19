"""A restricted conversation must not be ordered into an execution loop."""

import json

from agent.verification_evidence import mark_workspace_edited, verification_status
from agent.verification_stop import build_verify_on_stop_nudge


def test_preview_without_terminal_gets_one_honest_handoff(tmp_path):
    (tmp_path / "package.json").write_text(
        json.dumps({"scripts": {"test": "node --test"}}), encoding="utf-8"
    )
    preview = tmp_path / "preview.html"
    preview.write_text("<button>Calculate</button>", encoding="utf-8")
    mark_workspace_edited(session_id="preview", paths=[str(preview)], cwd=tmp_path)
    args = dict(session_id="preview", changed_paths=[str(preview)],
                available_tools={"write_file", "browser_navigate", "project_run"})
    assert "honest handoff" in build_verify_on_stop_nudge(**args)
    assert build_verify_on_stop_nudge(**args, attempts=1) is None
    assert verification_status(session_id="preview", cwd=tmp_path)["status"] != "passed"


def test_same_html_still_requires_execution_for_worker(tmp_path):
    (tmp_path / "package.json").write_text(
        json.dumps({"scripts": {"test": "node --test"}}), encoding="utf-8"
    )
    preview = tmp_path / "preview.html"
    preview.write_text("<button>Calculate</button>", encoding="utf-8")
    nudge = build_verify_on_stop_nudge(
        session_id="worker", changed_paths=[str(preview)], available_tools={"terminal"}
    )
    assert "Run the relevant verification command" in nudge
    assert "npm run test" in nudge
