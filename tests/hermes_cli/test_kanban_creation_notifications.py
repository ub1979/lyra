"""CLI creation must keep the same origin/opt-out policy as structured tools."""

import argparse
import json

import pytest


def create_cli(workspace, capsys):
    from hermes_cli import kanban

    parser = argparse.ArgumentParser()
    kanban.build_parser(parser.add_subparsers())
    args = parser.parse_args([
        "kanban",
        "create",
        "Project foundation",
        "--assignee",
        "external-worker",
        "--workspace",
        f"dir:{workspace}",
        "--idempotency-key",
        "stable-job",
        "--json",
    ])
    assert kanban.kanban_command(args) == 0
    return json.loads(capsys.readouterr().out)


@pytest.mark.parametrize("channel", ["tui", "telegram", "unattached", "opt-out"])
def test_cli_notification_routing_and_retry(tmp_path, monkeypatch, capsys, channel):
    from hermes_cli import kanban_db as kb
    from hermes_cli import kanban_notifications

    monkeypatch.setenv("HERMES_KANBAN_HOME", str(tmp_path / "kanban"))
    monkeypatch.setenv("HERMES_SESSION_ID", "telemetry-is-not-a-chat")
    if channel in {"tui", "opt-out"}:
        monkeypatch.setenv("HERMES_SESSION_KEY", "project-chat")
    if channel == "telegram":
        monkeypatch.setenv("HERMES_SESSION_PLATFORM", "telegram")
        monkeypatch.setenv("HERMES_SESSION_CHAT_ID", "allowed-chat")
        monkeypatch.setenv("HERMES_SESSION_THREAD_ID", "thread-2")
    if channel == "opt-out":
        monkeypatch.setattr(
            kanban_notifications,
            "load_config",
            lambda: {"kanban": {"auto_subscribe_on_create": False}},
        )
    first = create_cli(tmp_path, capsys)
    second = create_cli(tmp_path, capsys)
    assert first["id"] == second["id"]
    with kb.connect_closing() as conn:
        subscriptions = kb.list_notify_subs(conn, first["id"])
        assert kb.get_task(conn, first["id"]).assignee == "external-worker"
    assert first["subscribed"] == (channel in {"tui", "telegram"})
    assert len(subscriptions) == (1 if first["subscribed"] else 0)
    if channel == "tui":
        assert subscriptions[0]["chat_id"] == "project-chat"
        assert subscriptions[0]["platform"] == "tui"
    if channel == "telegram":
        assert subscriptions[0]["chat_id"] == "allowed-chat"
        assert subscriptions[0]["thread_id"] == "thread-2"


def test_cli_reports_notification_failure_without_losing_job(
    tmp_path, monkeypatch, capsys
):
    from hermes_cli import kanban_db as kb

    monkeypatch.setenv("HERMES_KANBAN_HOME", str(tmp_path / "kanban"))
    monkeypatch.setenv("HERMES_SESSION_KEY", "project-chat")

    def unavailable(*args, **kwargs):
        raise OSError("notification write unavailable")

    monkeypatch.setattr(kb, "add_notify_sub", unavailable)
    result = create_cli(tmp_path, capsys)
    assert result["subscribed"] is False
    with kb.connect_closing() as conn:
        assert kb.get_task(conn, result["id"]).status == "ready"


def test_explicitly_cleared_origin_does_not_inherit_another_chat(
    tmp_path, monkeypatch, capsys
):
    from gateway.session_context import set_session_vars

    monkeypatch.setenv("HERMES_KANBAN_HOME", str(tmp_path / "kanban"))
    monkeypatch.setenv("HERMES_SESSION_KEY", "other-chat-in-process-env")
    tokens = set_session_vars(session_key="")
    try:
        assert create_cli(tmp_path, capsys)["subscribed"] is False
    finally:
        for token in reversed(tokens):
            token.var.reset(token)
