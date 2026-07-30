"""LiveKit voice chat integration for Lyra dashboard."""

from __future__ import annotations

import importlib.util
import os


def is_available() -> bool:
    """True when both livekit (rtc) and livekit-api are importable."""
    return (
        importlib.util.find_spec("livekit") is not None
        and importlib.util.find_spec("livekit.rtc") is not None
    )


def is_enabled() -> bool:
    """True when the user has opted in via LIVEKIT_ENABLED=true."""
    return os.getenv("LIVEKIT_ENABLED", "").lower() in ("true", "1", "yes")


def get_livekit_url() -> str:
    return os.getenv("LIVEKIT_URL", "ws://127.0.0.1:7880")


def get_api_key() -> str:
    return os.getenv("LIVEKIT_API_KEY", "devkey")


def get_api_secret() -> str:
    return os.getenv("LIVEKIT_API_SECRET", "secret")
