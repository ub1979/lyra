from __future__ import annotations

import json
from types import SimpleNamespace

import pytest

from hermes_cli.auth import (
    AuthError,
    get_external_process_provider_status,
    resolve_external_process_provider_credentials,
)
from hermes_cli.models import normalize_provider, provider_model_ids
from hermes_cli.model_switch import list_authenticated_providers
from hermes_cli.providers import normalize_provider as normalize_provider_identity


def _patch_clean_config(monkeypatch):
    monkeypatch.setattr("hermes_cli.config.load_config", lambda: {})
    monkeypatch.setattr("hermes_cli.auth.shutil.which", lambda command: "/opt/bin/claude")


def test_claude_code_alias_is_distinct_from_anthropic_api():
    assert normalize_provider_identity("claude") == "anthropic"
    assert normalize_provider_identity("claude-code") == "claude-cli"
    assert normalize_provider_identity("claude-agent-sdk") == "claude-cli"
    assert normalize_provider("claude-code") == "claude-cli"


def test_status_verifies_real_cli_auth(monkeypatch):
    _patch_clean_config(monkeypatch)
    observed = {}

    def fake_run(command, **kwargs):
        observed["command"] = command
        observed["env"] = kwargs["env"]
        return SimpleNamespace(
            returncode=0,
            stdout=json.dumps(
                {"loggedIn": True, "authMethod": "claude.ai", "subscriptionType": "max"}
            ),
            stderr="",
        )

    monkeypatch.setattr("hermes_cli.auth.subprocess.run", fake_run)
    status = get_external_process_provider_status("claude-cli")

    assert observed["command"] == ["/opt/bin/claude", "auth", "status", "--json"]
    assert status["configured"] is True
    assert status["logged_in"] is True
    assert status["auth_method"] == "claude.ai"
    assert status["subscription_type"] == "max"


def test_runtime_credentials_reject_logged_out_cli(monkeypatch):
    _patch_clean_config(monkeypatch)
    monkeypatch.setattr(
        "hermes_cli.auth.subprocess.run",
        lambda *args, **kwargs: SimpleNamespace(
            returncode=1,
            stdout=json.dumps({"loggedIn": False}),
            stderr="not logged in",
        ),
    )

    with pytest.raises(AuthError, match="claude auth login"):
        resolve_external_process_provider_credentials("claude-cli")


def test_runtime_credentials_return_cli_marker(monkeypatch):
    _patch_clean_config(monkeypatch)
    monkeypatch.setattr(
        "hermes_cli.auth.subprocess.run",
        lambda *args, **kwargs: SimpleNamespace(
            returncode=0,
            stdout=json.dumps({"loggedIn": True, "authMethod": "claude.ai"}),
            stderr="",
        ),
    )

    creds = resolve_external_process_provider_credentials("claude-cli")

    assert creds == {
        "provider": "claude-cli",
        "api_key": "claude-cli",
        "base_url": "claude-cli://local",
        "command": "/opt/bin/claude",
        "args": [],
        "source": "process",
    }
    assert "claude-sonnet-4-6" in provider_model_ids("claude-cli")


def test_authenticated_cli_picker_row_contains_curated_models(monkeypatch):
    monkeypatch.setattr("agent.models_dev.fetch_models_dev", lambda: {})
    monkeypatch.setattr(
        "hermes_cli.auth.get_external_process_provider_status",
        lambda provider: {
            "provider": provider,
            "configured": True,
            "logged_in": True,
        },
    )

    rows = list_authenticated_providers(current_provider="claude-cli")
    row = next(item for item in rows if item["slug"] == "claude-cli")

    assert row["is_current"] is True
    assert row["total_models"] > 0
    assert "claude-sonnet-4-6" in row["models"]
