"""Contract for the restored-model policy used by ``session.resume``."""

from tui_gateway.restored_model_override import RestoredModelOverride


def _build(**overrides):
    fields = {
        "model": "glm-5.2:cloud",
        "provider": "",
        "base_url": "",
        "api_mode": "",
        "billing_provider": "custom",
        "configured_provider": "openai-codex",
    }
    fields.update(overrides)
    return RestoredModelOverride.build(**fields)


class TestBuildPairsModelWithProvider:
    def test_unpaired_model_is_not_restored(self):
        # The reported failure: glm lost its provider, config is Codex.
        assert _build() is None

    def test_explicit_provider_restores_model(self):
        override = _build(provider="custom:ollama-local")
        assert override["model"] == "glm-5.2:cloud"
        assert override["provider"] == "custom:ollama-local"

    def test_stored_base_url_restores_model(self):
        override = _build(base_url="http://127.0.0.1:11434/v1")
        assert override["base_url"] == "http://127.0.0.1:11434/v1"
        assert override["provider"] is None

    def test_billing_provider_matching_config_restores_model(self):
        override = _build(
            model="anthropic/claude-x",
            billing_provider="openrouter",
            configured_provider="OpenRouter",
        )
        assert override["model"] == "anthropic/claude-x"

    def test_config_without_provider_keeps_legacy_restore(self):
        for configured in ("", "auto"):
            assert _build(configured_provider=configured)["model"] == "glm-5.2:cloud"

    def test_empty_model_restores_nothing(self):
        assert _build(model="", provider="nous") is None

    def test_restored_override_is_marked(self):
        assert RestoredModelOverride.is_restored(_build(provider="nous"))


class TestSyncBlocking:
    def test_no_override_never_blocks(self):
        for follow in (True, False):
            assert not RestoredModelOverride.blocks_config_sync(None, follow)
            assert not RestoredModelOverride.blocks_config_sync({}, follow)

    def test_user_pin_always_blocks(self):
        pin = {"model": "pinned/model", "provider": "nous"}
        assert not RestoredModelOverride.is_restored(pin)
        for follow in (True, False):
            assert RestoredModelOverride.blocks_config_sync(pin, follow)

    def test_restored_override_yields_only_when_following(self):
        restored = _build(provider="nous")
        assert not RestoredModelOverride.blocks_config_sync(restored, True)
        assert RestoredModelOverride.blocks_config_sync(restored, False)


class TestResumeSyncBaseline:
    def test_following_session_has_no_baseline(self):
        assert RestoredModelOverride.resume_sync_baseline(True, ("m", "p")) is None

    def test_other_sessions_start_from_current_config(self):
        target = ("m", "p")
        assert RestoredModelOverride.resume_sync_baseline(False, target) == target
