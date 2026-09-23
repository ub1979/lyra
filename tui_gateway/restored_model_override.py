"""Policy for model overrides restored from a stored session row.

A resumed session restores the model its chat last used. Two rules keep that
restore from producing a model the configured provider cannot serve:

* **Pairing** — a stored model is restored only when its provider identity is
  known (explicit provider, recovered ``custom:<name>``, or a stored
  ``base_url``), when its billing provider is the configured provider, or when
  config names no provider at all. Otherwise nothing is restored and the
  session runs the configured provider + model together. Before this, a row
  that had lost its provider restored ``{"model": "glm-5.2:cloud",
  "provider": None}``; runtime resolution then filled in the configured
  provider (e.g. ``openai-codex``) and every turn failed with "model not
  supported".
* **Pinning** — a restored override is marked, so it is not mistaken for a
  user's explicit ``/model`` pin. In a session that follows the configured
  model (the dashboard chat, which presents one model chosen in settings) the
  per-turn config sync may replace a restored override, but never a user pin.
  Other surfaces (desktop chats with per-chat models) keep treating the
  restored model as the chat's own. Any real switch writes a fresh dict
  without the marker, so the marker cannot outlive the restore.
"""

from __future__ import annotations

from typing import Any

_RESTORED_KEY = "restored"
# Provider values that express "no preference" in config.yaml.
_UNSPECIFIED_PROVIDERS = {"", "auto"}


class RestoredModelOverride:
    """Build and classify session model overrides restored on resume."""

    @staticmethod
    def build(
        *,
        model: str,
        provider: str,
        base_url: str,
        api_mode: str,
        billing_provider: str,
        configured_provider: str,
    ) -> dict[str, Any] | None:
        """Return the override to restore, or ``None`` to use the configured pair."""
        if not model:
            return None
        configured = configured_provider.strip().lower()
        paired = (
            bool(provider)
            or bool(base_url)
            or configured in _UNSPECIFIED_PROVIDERS
            or configured == billing_provider.strip().lower()
        )
        if not paired:
            return None
        return {
            "model": model,
            "provider": provider or None,
            "base_url": base_url or None,
            "api_mode": api_mode or None,
            _RESTORED_KEY: True,
        }

    @staticmethod
    def is_restored(override: Any) -> bool:
        """True when ``override`` came from a session restore, not a user pick."""
        return isinstance(override, dict) and override.get(_RESTORED_KEY) is True

    @classmethod
    def blocks_config_sync(cls, override: Any, follow_config_model: bool) -> bool:
        """True when ``override`` must keep the session off the configured model.

        A user pin always blocks. A restored override blocks only when the
        session does not follow the configured model.
        """
        if not override:
            return False
        if cls.is_restored(override):
            return not follow_config_model
        return True

    @staticmethod
    def resume_sync_baseline(
        follow_config_model: bool, config_target: tuple[str, str]
    ) -> tuple[str, str] | None:
        """Baseline for the per-turn config sync when a session's agent is built.

        A following session gets no baseline, so its first turn adopts the
        configured model if the restored one differs. Others start from the
        current config and only adopt later config changes.
        """
        return None if follow_config_model else config_target
