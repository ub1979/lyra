from __future__ import annotations

import json
from unittest.mock import patch

import pytest

from agent.claude_cli_client import (
    ClaudeCLIClient,
    _claude_subprocess_env,
    _normalize_cli_model,
)
from agent.external_agent_client import (
    create_external_agent_client,
    is_external_agent_provider,
)


class _FakeProcess:
    def __init__(self, payload: dict, *, returncode: int = 0):
        self.returncode = returncode
        self.payload = payload
        self.input = None
        self.timeout = None
        self.killed = False

    def communicate(self, input=None, timeout=None):
        self.input = input
        self.timeout = timeout
        return json.dumps(self.payload), ""

    def kill(self):
        self.killed = True

    def terminate(self):
        self.killed = True

    def wait(self, timeout=None):
        return self.returncode


def test_external_agent_factory_routes_known_providers():
    assert is_external_agent_provider("claude-cli")
    assert is_external_agent_provider(None, "claude-cli://local")
    client = create_external_agent_client(
        "claude-cli",
        {"api_key": "claude-cli", "base_url": "claude-cli://local"},
    )
    assert isinstance(client, ClaudeCLIClient)
    assert client._acp_args == []
    assert create_external_agent_client("openrouter", {}) is None


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("anthropic/claude-sonnet-4-6", "claude-sonnet-4-6"),
        ("claude-cli/claude-opus-4-8", "claude-opus-4-8"),
        ("default", ""),
    ],
)
def test_normalize_cli_model(raw, expected):
    assert _normalize_cli_model(raw) == expected


def test_claude_environment_strips_api_billing_and_internal_credentials(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "api-billed")
    monkeypatch.setenv("ANTHROPIC_TOKEN", "token-billed")
    monkeypatch.setenv("ANTHROPIC_AUTH_TOKEN", "gateway-token")
    monkeypatch.setenv("ANTHROPIC_BASE_URL", "https://billable.example")
    monkeypatch.setenv("CLAUDE_CODE_OAUTH_TOKEN", "oauth-env")
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "gateway-secret")

    env = _claude_subprocess_env()

    assert "ANTHROPIC_API_KEY" not in env
    assert "ANTHROPIC_TOKEN" not in env
    assert "ANTHROPIC_AUTH_TOKEN" not in env
    assert "ANTHROPIC_BASE_URL" not in env
    assert env["CLAUDE_CODE_OAUTH_TOKEN"] == "oauth-env"
    assert "TELEGRAM_BOT_TOKEN" not in env


def test_completion_invokes_isolated_cli_and_returns_text():
    proc = _FakeProcess({"result": "hello from Claude", "is_error": False})
    captured = {}

    def fake_popen(command, **kwargs):
        captured["command"] = command
        captured["kwargs"] = kwargs
        return proc

    client = ClaudeCLIClient(command="/usr/bin/claude", args=["--effort", "low"])
    with patch("agent.claude_cli_client.subprocess.Popen", side_effect=fake_popen), patch(
        "agent.claude_cli_client._claude_subprocess_env", return_value={"HOME": "/tmp/home"}
    ):
        completion = client.chat.completions.create(
            model="anthropic/claude-sonnet-4-6",
            messages=[{"role": "user", "content": "Say hello"}],
            timeout=12,
        )

    command = captured["command"]
    assert command[:3] == ["/usr/bin/claude", "--effort", "low"]
    assert "--no-session-persistence" in command
    assert "--safe-mode" in command
    assert "--strict-mcp-config" in command
    assert command[command.index("--tools") + 1] == ""
    assert command[command.index("--model") + 1] == "claude-sonnet-4-6"
    assert captured["kwargs"]["env"] == {"HOME": "/tmp/home"}
    assert "Say hello" in proc.input
    assert proc.timeout == 12
    assert completion.choices[0].message.content == "hello from Claude"


def test_completion_surfaces_structured_cli_error():
    proc = _FakeProcess({"result": "", "is_error": True, "error": "usage exhausted"})
    client = ClaudeCLIClient(command="claude")
    with patch("agent.claude_cli_client.subprocess.Popen", return_value=proc), patch(
        "agent.claude_cli_client._claude_subprocess_env", return_value={}
    ):
        with pytest.raises(RuntimeError, match="usage exhausted"):
            client.chat.completions.create(
                model="claude-sonnet-4-6",
                messages=[{"role": "user", "content": "hello"}],
            )
