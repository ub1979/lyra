"""Real default-backend regression: confirm must not wedge the CLI daemon."""
import json
import time
import uuid
from unittest.mock import Mock

import pytest

from tools import browser_tool as bt
from tools import browser_dialog_tool as dt
from tools.browser_dialog_support import wait_for_command

# agent-browser daemonizes outside pytest's process ancestry. Cleanup still
# validates the exact UUID session, owner PID and command before terminating it.
pytestmark = pytest.mark.live_system_guard_bypass


@pytest.fixture
def local_browser(tmp_path, monkeypatch):
    monkeypatch.setattr(bt, "_get_cloud_provider", lambda: None)
    monkeypatch.setattr(bt, "_get_cdp_override", lambda: "")
    monkeypatch.setattr(bt, "_is_camofox_mode", lambda: False)
    monkeypatch.setattr(bt, "_get_browser_engine", lambda: "auto")
    try:
        binary = bt._find_agent_browser(validate=False)
    except FileNotFoundError:
        pytest.skip("local agent-browser not installed")
    if binary == "npx agent-browser" or not bt._chromium_installed():
        pytest.skip("test requires installed browser; never downloads one")
    task = "pytest-dialog-" + uuid.uuid4().hex
    page = tmp_path / "dialog.html"
    page.write_text(
        '<button onclick="document.title=confirm(\'Delete?\')">Delete</button>'
        '<button onclick="document.title=prompt(\'Name?\',\'initial\')">Name</button>',
        encoding="utf-8",
    )
    try:
        result = json.loads(bt.browser_navigate(page.as_uri(), task_id=task))
        assert result["success"], result
        yield task, page.as_uri()
    finally:
        bt.cleanup_browser(task)


@pytest.mark.parametrize("action,expected", [("dismiss", "false"), ("accept", "true")])
def test_native_confirm_recovers_same_browser(local_browser, action, expected):
    task, url = local_browser
    original_session = bt._active_sessions[task]["session_name"]
    assert dt._browser_dialog_check()
    start = time.monotonic()
    result = json.loads(bt.browser_click("e1", task_id=task))
    assert time.monotonic() - start < 10
    assert result["pending_dialogs"][0]["type"] == "confirm", result
    # Snapshot must describe the blocker without joining the blocked CLI queue.
    snapshot = json.loads(bt.browser_snapshot(task_id=task))
    assert snapshot["pending_dialogs"]
    assert json.loads(bt._browser_eval("document.title", task_id=task))["pending_dialogs"]
    assert json.loads(bt.browser_navigate(url, task_id=task))["pending_dialogs"]
    reply = json.loads(dt.browser_dialog(action, task_id=task))
    assert reply["success"], reply
    title = bt._run_browser_command(task, "eval", ["document.title"], timeout=5)
    assert title["data"]["result"] == expected
    assert json.loads(bt.browser_navigate(url, task_id=task))["success"]
    assert bt._active_sessions[task]["session_name"] == original_session
    assert not bt._active_sessions[task]["cdp_url"]  # CLI stays task-isolated.


@pytest.mark.parametrize("backend", ["camofox", "lightpanda"])
def test_unsupported_local_backend_not_advertised(monkeypatch, backend):
    from tools import browser_cdp_tool

    monkeypatch.setattr(browser_cdp_tool, "_browser_cdp_check", lambda: False)
    monkeypatch.setattr(bt, "_is_camofox_mode", lambda: backend == "camofox")
    monkeypatch.setattr(bt, "_is_local_mode", lambda: True)
    monkeypatch.setattr(bt, "_using_lightpanda_engine", lambda: backend == "lightpanda")
    assert not dt._browser_dialog_check()


def test_prompt_text_and_other_task_are_isolated(local_browser):
    task, _ = local_browser
    result = json.loads(bt.browser_click("e2", task_id=task))
    assert result["pending_dialogs"][0]["type"] == "prompt"
    assert not json.loads(dt.browser_dialog("accept", task_id="not-this-task"))["success"]
    assert not json.loads(dt.browser_dialog("accept", dialog_id="stale", task_id=task))["success"]
    assert json.loads(dt.browser_dialog("accept", prompt_text="Ada", task_id=task))["success"]
    assert bt._run_browser_command(task, "eval", ["document.title"], timeout=5)["data"]["result"] == "Ada"


def test_wrapper_preserves_redacted_dialog_and_warning():
    shaped = bt._copy_fallback_warning({}, {
        "warning": "Dialog pending", "pending_dialogs": [{"type": "confirm", "message": "Delete?"}],
        "fallback_warning": "Chrome fallback", "browser_engine": "chrome",
    })
    assert shaped["warning"] == "Dialog pending"
    assert shaped["pending_dialogs"][0]["message"] == "Delete?"
    assert shaped["browser_engine"] == "chrome"


def test_dialog_routes_to_active_sidecar(monkeypatch):
    supervisor = Mock()
    supervisor.respond_to_dialog.return_value = {"ok": True}
    get = Mock(return_value=supervisor)
    monkeypatch.setattr(bt, "_last_session_key", lambda task: task + "::local")
    monkeypatch.setattr(dt.SUPERVISOR_REGISTRY, "get", get)
    assert json.loads(dt.browser_dialog("dismiss", task_id="worker"))["success"]
    get.assert_called_once_with("worker::local")


def test_command_without_supervisor_uses_original_deadline(monkeypatch):
    monkeypatch.setattr(dt.SUPERVISOR_REGISTRY, "get", lambda task: None)
    proc = Mock()
    wait_for_command(proc, 7, "worker")
    proc.wait.assert_called_once_with(timeout=7)
