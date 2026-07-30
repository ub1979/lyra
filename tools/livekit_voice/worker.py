"""Voice worker: bridges LiveKit room <-> Lyra event channel.

Connects to a LiveKit room as a bot participant, subscribes to the user's
audio track for STT, and publishes synthesized TTS audio back. The worker
owns the BUILDING/IDLE state machine and routes transcripts accordingly.
"""

from __future__ import annotations

import asyncio
import json
import logging
from enum import Enum, auto
from typing import Any

logger = logging.getLogger(__name__)


class WorkerState(Enum):
    IDLE = auto()
    BUILDING = auto()


class _QueueSubscriber:
    """Mimics a WebSocket for event channel subscription.

    ``_broadcast_event`` calls ``sub.send_text(payload)`` on subscribers.
    This adapter puts payloads into an asyncio.Queue so the worker can
    consume them without a real WebSocket connection.
    """

    def __init__(self):
        self.queue: asyncio.Queue[str] = asyncio.Queue()

    async def send_text(self, payload: str) -> None:
        await self.queue.put(payload)


async def _subscribe_to_channel(app: Any, channel_id: str) -> _QueueSubscriber:
    """Register a queue-based subscriber on the event channel."""
    from hermes_cli.web_server import _get_event_state

    event_channels, event_lock = _get_event_state(app)
    sub = _QueueSubscriber()
    async with event_lock:
        if channel_id not in event_channels:
            event_channels[channel_id] = set()
        event_channels[channel_id].add(sub)
    return sub


async def _unsubscribe_from_channel(app: Any, channel_id: str, sub: _QueueSubscriber) -> None:
    from hermes_cli.web_server import _get_event_state

    event_channels, event_lock = _get_event_state(app)
    async with event_lock:
        subs = event_channels.get(channel_id)
        if subs:
            subs.discard(sub)


async def run_voice_worker(app: Any, room_name: str, channel_id: str) -> None:
    """Main voice worker coroutine."""
    from tools.livekit_voice import get_livekit_url
    from tools.livekit_voice.token import generate_token

    try:
        from tools.lazy_deps import ensure
        ensure("voice.livekit", prompt=False)
    except Exception:
        logger.warning("LiveKit packages not available, attempting import anyway")

    try:
        from livekit import rtc
    except ImportError:
        logger.error("livekit-rtc not importable — voice worker cannot start")
        return

    loop = asyncio.get_running_loop()
    state = WorkerState.IDLE

    event_sub = await _subscribe_to_channel(app, channel_id)

    token = generate_token(room_name, "lyra-voice-bot")

    room = rtc.Room()

    try:
        await room.connect(get_livekit_url(), token)
        logger.info("Voice worker connected to room %s", room_name)
    except Exception:
        logger.exception("Failed to connect to LiveKit room %s", room_name)
        await _unsubscribe_from_channel(app, channel_id, event_sub)
        return

    tts_source = rtc.AudioSource(sample_rate=24000, num_channels=1)
    tts_track = rtc.LocalAudioTrack.create_audio_track("lyra-tts", tts_source)
    publish_options = rtc.TrackPublishOptions()
    await room.local_participant.publish_track(tts_track, publish_options)

    from tools.livekit_voice.stt_bridge import VoiceActivityBuffer

    vad_buffer = VoiceActivityBuffer(sample_rate=16000)

    # STT runs in a background task to avoid blocking the audio stream
    stt_queue: asyncio.Queue[bytes] = asyncio.Queue()
    recent_events: list[dict] = []

    async def _stt_consumer() -> None:
        nonlocal state
        from tools.livekit_voice.stt_bridge import transcribe_wav
        from tools.livekit_voice.companion import respond_to_user

        while True:
            try:
                wav_data = await stt_queue.get()
            except asyncio.CancelledError:
                return

            transcript = await transcribe_wav(wav_data, loop)
            if not transcript:
                continue

            logger.info("STT transcript: %s", transcript)

            if state == WorkerState.IDLE:
                payload = json.dumps({"type": "transcript", "text": transcript})
                try:
                    await room.local_participant.publish_data(
                        payload.encode("utf-8"),
                        reliable=True,
                    )
                except Exception:
                    logger.warning("Failed to publish transcript data")
            else:
                response = await respond_to_user(transcript, recent_events)
                if response:
                    await _speak_sentence(response, tts_source, loop)

    stt_task = asyncio.create_task(_stt_consumer())

    async def _handle_audio_frame(frame: rtc.AudioFrame) -> None:
        """Feed audio to VAD; queue completed segments for async STT."""
        pcm_data = bytes(frame.data)
        wav_data = vad_buffer.feed(pcm_data)
        if wav_data is not None:
            await stt_queue.put(wav_data)

    audio_streams: dict[str, asyncio.Task] = {}

    @room.on("track_subscribed")
    def on_track_subscribed(
        track: rtc.Track,
        publication: rtc.RemoteTrackPublication,
        participant: rtc.RemoteParticipant,
    ):
        if track.kind != rtc.TrackKind.KIND_AUDIO:
            return
        stream = rtc.AudioStream(track, sample_rate=16000, num_channels=1)
        task = asyncio.ensure_future(_process_audio_stream(stream))
        audio_streams[track.sid] = task

    @room.on("track_unsubscribed")
    def on_track_unsubscribed(
        track: rtc.Track,
        publication: rtc.RemoteTrackPublication,
        participant: rtc.RemoteParticipant,
    ):
        task = audio_streams.pop(track.sid, None)
        if task:
            task.cancel()

    async def _process_audio_stream(stream: rtc.AudioStream) -> None:
        async for event in stream:
            await _handle_audio_frame(event.frame)

    async def _process_events() -> None:
        nonlocal state

        from tools.tts_streaming import SentenceChunker
        from tools.livekit_voice.companion import narrate_event

        chunker = SentenceChunker()

        while True:
            try:
                payload = await event_sub.queue.get()
            except asyncio.CancelledError:
                return

            try:
                event = json.loads(payload)
            except json.JSONDecodeError:
                continue

            params = event.get("params")
            if event.get("method") != "event" or not params:
                continue

            event_type = params.get("type", "")
            event_payload = params.get("payload")

            recent_events.append({"type": event_type, "payload": event_payload})
            if len(recent_events) > 20:
                del recent_events[:10]

            if event_type == "message.start":
                state = WorkerState.BUILDING

            elif event_type == "message.delta":
                ep = event_payload or {}
                delta = ep.get("text", "")
                if delta:
                    sentences = chunker.feed(delta)
                    for sentence in sentences:
                        await _speak_sentence(sentence, tts_source, loop)

            elif event_type == "message.complete":
                remaining = chunker.flush()
                for sentence in remaining:
                    await _speak_sentence(sentence, tts_source, loop)
                state = WorkerState.IDLE
                recent_events.clear()

            elif state == WorkerState.BUILDING:
                narration = narrate_event(event_type, event_payload)
                if narration:
                    await _speak_sentence(narration, tts_source, loop)

    event_task = asyncio.create_task(_process_events())

    disconnect_event = asyncio.Event()

    @room.on("disconnected")
    def on_disconnected():
        disconnect_event.set()

    try:
        await disconnect_event.wait()
    except asyncio.CancelledError:
        pass
    finally:
        logger.info("Voice worker shutting down for room %s", room_name)
        event_task.cancel()
        stt_task.cancel()
        for task in audio_streams.values():
            task.cancel()
        await _unsubscribe_from_channel(app, channel_id, event_sub)
        await room.disconnect()


async def _speak_sentence(
    sentence: str,
    tts_source: Any,
    loop: asyncio.AbstractEventLoop,
) -> None:
    """Synthesize one sentence and push frames to the TTS audio source."""
    from tools.livekit_voice.tts_bridge import synthesize_to_frames

    frames = await synthesize_to_frames(sentence, loop)
    if not frames:
        return

    try:
        from livekit import rtc

        for pcm_chunk in frames:
            audio_frame = rtc.AudioFrame(
                data=pcm_chunk,
                sample_rate=24000,
                num_channels=1,
                samples_per_channel=len(pcm_chunk) // 2,
            )
            await tts_source.capture_frame(audio_frame)
    except Exception:
        logger.warning("Failed to publish TTS audio frame", exc_info=True)
