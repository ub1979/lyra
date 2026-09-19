"""Headless CLI workers must not wait on an input UI that does not exist."""

from unittest.mock import Mock
import threading

import pytest


def test_headless_callback_denies_before_constructing_a_modal(monkeypatch):
    import cli

    worker = cli.HermesCLI.__new__(cli.HermesCLI)
    worker._app = None
    worker._approval_lock = threading.Lock()
    monkeypatch.setattr(cli.queue, "Queue", Mock(side_effect=AssertionError("unreachable modal")))
    result = worker._approval_callback("flagged command", "needs permission")
    assert result == "deny"
    assert result.reason == "unavailable"


@pytest.mark.parametrize("reason", ["unavailable", "timeout"])
def test_real_command_gate_preserves_nonconsent_without_claiming_user_denied(monkeypatch, reason):
    from tools import approval
    from tools.approval_outcome import ApprovalDenied

    monkeypatch.setattr(approval, "_get_approval_mode", lambda: "manual")
    monkeypatch.setattr(approval, "is_current_session_yolo_enabled", lambda: False)
    monkeypatch.setattr(approval, "_YOLO_MODE_FROZEN", False)
    monkeypatch.setattr(approval, "is_approved", lambda *args: False)
    monkeypatch.setattr(approval, "_is_interactive_cli", lambda: True)
    monkeypatch.setattr(approval, "_is_gateway_approval_context", lambda: False)
    result = approval.check_dangerous_command(
        "python -c 'print(1)'", "local",
        approval_callback=lambda *args, **kwargs: ApprovalDenied(reason),
    )
    assert result["approved"] is False
    assert result["user_consent"] is False
    assert result["outcome"] == reason
    assert "User denied" not in result["message"]
    assert "needs_input" in result["message"]


def test_unavailable_result_remains_deny_for_legacy_callback_consumers():
    from tools.approval_outcome import ApprovalDenied

    denied = ApprovalDenied("unavailable")
    assert isinstance(denied, str) and denied == "deny"
    assert denied not in {"once", "session", "always"}


def test_plugin_approval_gate_preserves_unavailable_reason(monkeypatch):
    from tools import approval
    from tools.approval_outcome import ApprovalDenied

    monkeypatch.setattr(approval, "is_current_session_yolo_enabled", lambda: False)
    monkeypatch.setattr(approval, "_YOLO_MODE_FROZEN", False)
    monkeypatch.setattr(approval, "is_approved", lambda *args: False)
    monkeypatch.setattr(approval, "_is_interactive_cli", lambda: True)
    monkeypatch.setattr(approval, "_is_gateway_approval_context", lambda: False)
    monkeypatch.setattr(approval, "prompt_dangerous_approval", lambda *a, **k: ApprovalDenied("unavailable"))
    result = approval.request_tool_approval("terminal", "needs permission")
    assert not result["approved"]
    assert result["outcome"] == "unavailable"


def test_interactive_timeout_keeps_reason_and_clears_modal(monkeypatch):
    import cli
    from types import SimpleNamespace

    worker = cli.HermesCLI.__new__(cli.HermesCLI)
    worker._app = SimpleNamespace()
    worker._approval_lock = threading.Lock()
    worker._paint_now = Mock()
    queue = Mock()
    queue.get.side_effect = cli.queue.Empty
    monkeypatch.setattr(cli.queue, "Queue", lambda: queue)
    monkeypatch.setitem(cli.CLI_CONFIG, "approvals", {"timeout": 0})
    result = worker._approval_callback("flagged command", "needs permission")
    assert result == "deny" and result.reason == "timeout"
    assert worker._approval_state is None and worker._approval_deadline == 0
