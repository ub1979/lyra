"""Regression: Settings says Claude while retry invokes a saved GLM model."""

import json
import sys
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

from tui_gateway import server
from tui_gateway.studio_model_routing import studio_model_override


STUDIO_SKILLS = ["ultimate-builder:app-it"]
SELECTED = {"default": "claude-opus-4-6", "provider": "claude-cli"}


def test_studio_pair_is_atomic_and_does_not_change_worker_or_regular_pins():
    cfg = {"model": SELECTED}
    assert studio_model_override(cfg, STUDIO_SKILLS) == {
        "model": "claude-opus-4-6",
        "provider": "claude-cli",
    }
    assert studio_model_override(cfg, []) is None
    assert studio_model_override(cfg, ["ultimate-builder:ultimate-app-builder"]) is None
    assert (
        studio_model_override({"model": {"default": "glm-5-2:cloud"}}, STUDIO_SKILLS)
        is None
    )


@pytest.mark.parametrize("use_environment_skills", [False, True])
def test_resumed_glm_session_invokes_selected_claude_in_real_subprocess(
    tmp_path, monkeypatch, use_environment_skills
):
    """Real config/provider resolver and CLI subprocess; no paid model call."""
    from agent.claude_cli_client import ClaudeCLIClient
    from hermes_constants import set_hermes_home_override, reset_hermes_home_override

    cli = tmp_path / "claude"
    cli.write_text(
        f"#!{sys.executable}\n"
        "import json, sys\n"
        "if sys.argv[1:3] == ['auth', 'status']:\n"
        "    print(json.dumps({'loggedIn': True, 'authMethod': 'claude.ai'}))\n"
        "else:\n"
        "    sys.stdin.read()\n"
        "    print(json.dumps({'result': sys.argv[sys.argv.index('--model') + 1]}))\n"
    )
    cli.chmod(0o755)
    cfg = {"model": SELECTED, "providers": {"claude-cli": {"command": str(cli)}}}
    import yaml

    (tmp_path / "config.yaml").write_text(yaml.safe_dump(cfg))
    monkeypatch.setenv("HERMES_HOME", str(tmp_path))
    monkeypatch.setenv("HERMES_MODEL", "glm-5-2:cloud")
    monkeypatch.setenv("HERMES_TUI_SKILLS", ",".join(STUDIO_SKILLS))
    monkeypatch.setattr(server, "_load_cfg", lambda: cfg)
    monkeypatch.setattr(server, "_get_db", MagicMock())
    monkeypatch.setattr(server, "_load_reasoning_config", lambda *a: None)
    monkeypatch.setattr(server, "_load_enabled_toolsets", lambda: [])
    monkeypatch.setattr(server, "_load_service_tier", lambda: None)
    monkeypatch.setattr(server, "_agent_cbs", lambda *a: {})
    monkeypatch.setattr(
        "agent.skill_commands.build_preloaded_skills_prompt",
        lambda *a, **kw: ("", STUDIO_SKILLS, []),
    )
    constructor = MagicMock(return_value=SimpleNamespace())
    monkeypatch.setattr("run_agent.AIAgent", constructor)
    token = set_hermes_home_override(str(tmp_path))
    try:
        overrides = server._stored_session_runtime_overrides({
            "model": "glm-5-2:cloud",
            "model_config": json.dumps({"provider": "claude-cli"}),
        })
        for _ in range(2):  # reconnect/retry must not restore the stale pair
            server._make_agent(
                "studio",
                "saved-project-chat",
                **overrides,
                skills_override=None if use_environment_skills else STUDIO_SKILLS,
            )
            args = constructor.call_args.kwargs
            assert args["provider"] == "claude-cli"
            assert args["model"] == "claude-opus-4-6"
            client = ClaudeCLIClient(command=args["acp_command"])
            response = client.chat.completions.create(
                model=args["model"], messages=[{"role": "user", "content": "retry"}]
            )
            assert response.choices[0].message.content == "claude-opus-4-6"
    finally:
        reset_hermes_home_override(token)


def test_live_studio_retry_replaces_pin_and_retries_failed_switch(monkeypatch):
    agent = SimpleNamespace(model="glm-5-2:cloud", provider="claude-cli")
    session = {
        "agent": agent,
        "create_skills": STUDIO_SKILLS,
        "model_override": {"model": agent.model},
        "history": ["saved"],
    }
    monkeypatch.setattr(
        server,
        "_config_model_target",
        lambda: (SELECTED["default"], SELECTED["provider"]),
    )
    attempts = []

    def switch(sid, actual, raw, **kwargs):
        attempts.append(raw)
        assert kwargs["persist_override"] is False
        if len(attempts) == 1:
            raise ValueError("temporary connection failure")
        actual["agent"].model = SELECTED["default"]

    monkeypatch.setattr(server, "_apply_model_switch", switch)
    with pytest.raises(ValueError, match="could not use your selected AI model"):
        server._sync_agent_model_with_config("studio", session)
    server._sync_agent_model_with_config("studio", session)
    server._sync_agent_model_with_config("studio", session)
    assert len(attempts) == 2
    assert agent.model == SELECTED["default"]
    assert "model_override" not in session
    assert session["history"] == ["saved"]


def test_regular_session_still_keeps_explicit_model_pin(monkeypatch):
    session = {
        "agent": SimpleNamespace(model="pinned"),
        "create_skills": [],
        "model_override": {"model": "pinned"},
    }
    switch = MagicMock()
    monkeypatch.setattr(server, "_apply_model_switch", switch)
    server._sync_agent_model_with_config("regular", session)
    switch.assert_not_called()
