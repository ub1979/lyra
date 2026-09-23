"""Dashboard chats follow the model chosen in settings after a resume.

Regression: a resumed project chat restored ``glm-5.2:cloud`` without a
provider; the configured provider (``openai-codex``) was filled in at build
time and every turn failed with "The 'glm-5.2:cloud' model is not supported
when using Codex with a ChatGPT account". Separately, the restored model was
treated as a /model pin, so the per-turn config sync never adopted the model
the user picked in settings.
"""

import types

import pytest

from tui_gateway import server


def _config(monkeypatch, model, provider):
    monkeypatch.delenv("HERMES_MODEL", raising=False)
    monkeypatch.delenv("HERMES_INFERENCE_MODEL", raising=False)
    monkeypatch.setattr(
        server,
        "_load_cfg",
        lambda: {"model": {"default": model, "provider": provider}},
    )


def _resumed_session(override, *, follow, seen=None):
    return {
        "agent": types.SimpleNamespace(model="glm-5.2:cloud", provider="custom"),
        "session_key": "session-key",
        "model_override": override,
        "follow_config_model": follow,
        "config_model_seen": seen,
    }


class TestStoredOverridesNeverCrossProviders:
    def test_providerless_row_uses_configured_pair(self, monkeypatch):
        _config(monkeypatch, "gpt-5.5", "openai-codex")

        overrides = server._stored_session_runtime_overrides(
            {"model": "glm-5.2:cloud", "billing_provider": "custom"}
        )

        assert "model_override" not in overrides
        assert "provider_override" not in overrides

    def test_row_with_provider_restores_its_own_model(self, monkeypatch):
        _config(monkeypatch, "gpt-5.5", "openai-codex")

        overrides = server._stored_session_runtime_overrides(
            {
                "model": "glm-5.2:cloud",
                "model_config": {"provider": "ollama-cloud"},
            }
        )

        assert overrides["model_override"]["model"] == "glm-5.2:cloud"
        assert overrides["model_override"]["provider"] == "ollama-cloud"
        assert overrides["provider_override"] == "ollama-cloud"


class TestConfigSyncAfterResume:
    @pytest.fixture
    def switches(self, monkeypatch):
        calls = []
        monkeypatch.setattr(
            server,
            "_apply_model_switch",
            lambda sid, sess, raw, **kw: calls.append(raw),
        )
        return calls

    def _restored(self):
        return server.RestoredModelOverride.build(
            model="glm-5.2:cloud",
            provider="ollama-cloud",
            base_url="",
            api_mode="",
            billing_provider="",
            configured_provider="openai-codex",
        )

    def test_following_session_adopts_configured_model(self, monkeypatch, switches):
        _config(monkeypatch, "gpt-5.5", "openai-codex")
        session = _resumed_session(self._restored(), follow=True)

        server._sync_agent_model_with_config("sid", session)

        assert switches == ["gpt-5.5 --provider openai-codex"]
        # A later rebuild must not resurrect the old model.
        assert "model_override" not in session

    def test_other_surfaces_keep_the_restored_model(self, monkeypatch, switches):
        _config(monkeypatch, "gpt-5.5", "openai-codex")
        session = _resumed_session(self._restored(), follow=False)

        server._sync_agent_model_with_config("sid", session)

        assert switches == []
        assert session["model_override"]["model"] == "glm-5.2:cloud"

    def test_user_pin_is_respected_even_when_following(self, monkeypatch, switches):
        _config(monkeypatch, "gpt-5.5", "openai-codex")
        pin = {"model": "pinned/model", "provider": "nous"}
        session = _resumed_session(pin, follow=True)

        server._sync_agent_model_with_config("sid", session)

        assert switches == []
        assert session["model_override"] is pin

    def test_failed_switch_keeps_restored_override(self, monkeypatch):
        _config(monkeypatch, "gpt-5.5", "openai-codex")
        restored = self._restored()
        session = _resumed_session(restored, follow=True)

        def fail(*_a, **_k):
            raise ValueError("no credentials")

        monkeypatch.setattr(server, "_apply_model_switch", fail)
        monkeypatch.setattr(server, "_emit", lambda *a, **k: None)

        server._sync_agent_model_with_config("sid", session)

        assert session["model_override"] is restored
