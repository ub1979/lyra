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


# ── token usage reporting ────────────────────────────────────────────────────
# The CLI reports usage in its JSON payload, but _run_prompt used to discard
# everything except `result`, so every turn logged in=0 out=0 total=0 and
# prompt-cache behaviour was invisible. Keys below match a real
# `claude --print --output-format json` response.

def _usage_payload(**over):
    usage = {
        "input_tokens": 1,
        "cache_creation_input_tokens": 1656,
        "cache_read_input_tokens": 3289,
        "output_tokens": 13,
    }
    usage.update(over)
    return {"result": "hi", "usage": usage}


def _complete(payload):
    proc = _FakeProcess(payload)
    client = ClaudeCLIClient(command="claude")
    with patch("agent.claude_cli_client.subprocess.Popen", return_value=proc), patch(
        "agent.claude_cli_client._claude_subprocess_env", return_value={}
    ):
        return client.chat.completions.create(
            model="claude-sonnet-4-6",
            messages=[{"role": "user", "content": "hello"}],
        )


def test_completion_reports_cli_token_usage():
    usage = _complete(_usage_payload()).usage
    # All three input buckets are prompt tokens the request actually carried.
    assert usage.prompt_tokens == 1 + 3289 + 1656
    assert usage.completion_tokens == 13
    assert usage.total_tokens == 4959
    # The cache-read share is what shows whether prompt caching is working.
    assert usage.prompt_tokens_details.cached_tokens == 3289


def test_completion_usage_defaults_to_zero_without_cli_usage():
    usage = _complete({"result": "hi"}).usage
    assert (usage.prompt_tokens, usage.completion_tokens, usage.total_tokens) == (0, 0, 0)
    assert usage.prompt_tokens_details.cached_tokens == 0


def test_completion_usage_survives_malformed_counts():
    usage = _complete(_usage_payload(input_tokens="x", output_tokens=None)).usage
    assert usage.prompt_tokens == 3289 + 1656
    assert usage.completion_tokens == 0


def test_usage_is_not_carried_into_a_later_request():
    """The thread-local slot must drain, or turn two inherits turn one's counts."""
    assert _complete(_usage_payload()).usage.total_tokens == 4959
    assert _complete({"result": "hi"}).usage.total_tokens == 0


# ── CLI default system prompt suppression ────────────────────────────────────
# Hermes serializes its own system message into the stdin transcript, so the
# CLI's built-in Claude Code agent prompt is duplicated overhead — measured at
# ~4.8k prompt tokens per call for tools that `--tools ""` already disables.

def _command_for(*, args=None):
    proc = _FakeProcess({"result": "ok"})
    captured = {}
    real_popen_args = {}

    def _fake_popen(command, **kwargs):
        real_popen_args["command"] = command
        return proc

    client = ClaudeCLIClient(command="claude", args=list(args or []))
    with patch("agent.claude_cli_client.subprocess.Popen", side_effect=_fake_popen), patch(
        "agent.claude_cli_client._claude_subprocess_env", return_value={}
    ):
        client.chat.completions.create(
            model="claude-sonnet-4-6",
            messages=[{"role": "user", "content": "hello"}],
        )
    captured.update(real_popen_args)
    return captured["command"]


def test_cli_default_system_prompt_is_suppressed():
    command = _command_for()
    assert "--system-prompt" in command
    assert command[command.index("--system-prompt") + 1] == ""


def test_operator_system_prompt_override_is_not_duplicated():
    """An explicit providers.claude-cli.args entry must win, not collide."""
    command = _command_for(args=["--system-prompt", "custom prompt"])
    assert command.count("--system-prompt") == 1
    assert command[command.index("--system-prompt") + 1] == "custom prompt"


def test_operator_system_prompt_file_override_is_respected():
    command = _command_for(args=["--system-prompt-file", "/tmp/p.txt"])
    assert "--system-prompt" not in [a for a in command if a == "--system-prompt"]
    assert "--system-prompt-file" in command
