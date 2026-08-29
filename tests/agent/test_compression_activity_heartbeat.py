"""Guided-chat regression coverage for context-compression heartbeats."""

from agent.conversation_compression import (
    COMPACTION_HEARTBEAT_STATUS,
    _CompressionActivityHeartbeat,
)


class _Agent:
    def __init__(self, platform: str) -> None:
        self.platform = platform
        self.activity: list[str] = []
        self.statuses: list[tuple[str, str]] = []

    def _touch_activity(self, desc: str) -> None:
        self.activity.append(desc)

    def status_callback(self, kind: str, text: str) -> None:
        self.statuses.append((kind, text))


def test_compression_heartbeat_reaches_structured_tui_status() -> None:
    agent = _Agent("tui")

    _CompressionActivityHeartbeat(agent)._touch("context compression in progress")

    assert agent.activity == ["context compression in progress"]
    assert agent.statuses == [("compacting", COMPACTION_HEARTBEAT_STATUS)]


def test_compression_heartbeat_does_not_spam_messaging_status() -> None:
    agent = _Agent("telegram")

    _CompressionActivityHeartbeat(agent)._touch("context compression in progress")

    assert agent.activity == ["context compression in progress"]
    assert agent.statuses == []
