"""LiveKit access token generation."""

from __future__ import annotations

from tools.livekit_voice import get_api_key, get_api_secret


def generate_token(room: str, identity: str) -> str:
    """Generate a JWT for the given room and participant identity."""
    from livekit.api import AccessToken, VideoGrants

    token = (
        AccessToken(get_api_key(), get_api_secret())
        .with_identity(identity)
        .with_grants(VideoGrants(room_join=True, room=room))
    )
    return token.to_jwt()
