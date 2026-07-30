"""TTS bridge: text → PCM audio frames for LiveKit publication."""

from __future__ import annotations

import asyncio
import logging
import os
import subprocess
import tempfile
import threading
import wave

logger = logging.getLogger(__name__)

SAMPLE_RATE = 24000
CHANNELS = 1
SAMPLE_WIDTH = 2  # int16
FRAME_DURATION_MS = 20
FRAME_SAMPLES = SAMPLE_RATE * FRAME_DURATION_MS // 1000
FRAME_BYTES = FRAME_SAMPLES * SAMPLE_WIDTH * CHANNELS

_kittentts_lock = threading.Lock()


def _get_tts_provider() -> str:
    return os.getenv("VOICE_TTS_PROVIDER", "edge").lower()


def _synthesize_edge(text: str, mp3_path: str) -> bool:
    """Synthesize with edge-tts. Output is always MP3."""
    try:
        from tools.lazy_deps import ensure
        ensure("tts.edge", prompt=False)
    except Exception:
        pass

    try:
        from tools.tts_tool import _load_tts_config
        import asyncio as _aio
        _aio.run(_synthesize_edge_async(text, mp3_path, _load_tts_config()))
        return True
    except Exception:
        logger.exception("edge-tts synthesis failed")
        return False


async def _synthesize_edge_async(text: str, output_path: str, tts_config: dict) -> None:
    from tools.tts_tool import _generate_edge_tts
    await _generate_edge_tts(text, output_path, tts_config)


def _mp3_to_wav(mp3_path: str, wav_path: str) -> bool:
    """Convert MP3 to WAV using ffmpeg."""
    try:
        subprocess.run(
            [
                "ffmpeg", "-y", "-i", mp3_path,
                "-ar", str(SAMPLE_RATE),
                "-ac", "1",
                "-sample_fmt", "s16",
                wav_path,
            ],
            capture_output=True,
            timeout=30,
        )
        return os.path.exists(wav_path) and os.path.getsize(wav_path) > 44
    except (FileNotFoundError, subprocess.TimeoutExpired):
        logger.warning("ffmpeg not available for MP3→WAV conversion")
        return False


def _synthesize_kittentts(text: str, wav_path: str) -> bool:
    """Synthesize with KittenTTS (sync, outputs WAV)."""
    try:
        from tools.tts_tool import _generate_kittentts, _load_tts_config
        with _kittentts_lock:
            _generate_kittentts(text, wav_path, _load_tts_config())
        return True
    except ImportError:
        logger.warning("KittenTTS not installed — falling back to edge")
        return False
    except Exception:
        logger.exception("KittenTTS synthesis failed")
        return False


def _read_pcm_frames(wav_path: str) -> list[bytes]:
    """Read a WAV file and return a list of fixed-size PCM frames."""
    try:
        with wave.open(wav_path, "rb") as wf:
            raw = wf.readframes(wf.getnframes())
            file_rate = wf.getframerate()
            file_channels = wf.getnchannels()
            file_width = wf.getsampwidth()
    except Exception:
        logger.exception("Failed to read WAV: %s", wav_path)
        return []

    pcm = _resample_to_mono_int16(raw, file_rate, file_channels, file_width)

    frames = []
    for i in range(0, len(pcm), FRAME_BYTES):
        chunk = pcm[i:i + FRAME_BYTES]
        if len(chunk) < FRAME_BYTES:
            chunk = chunk + b"\x00" * (FRAME_BYTES - len(chunk))
        frames.append(chunk)
    return frames


def _resample_to_mono_int16(
    raw: bytes, src_rate: int, src_channels: int, src_width: int
) -> bytes:
    """Convert to mono int16 at SAMPLE_RATE using audioop (C-speed) with fallback."""
    try:
        import audioop
        if src_width != 2:
            raw = audioop.lin2lin(raw, src_width, 2)
        if src_channels > 1:
            raw = audioop.tomono(raw, 2, 1.0 / src_channels, 1.0 / src_channels)
        if src_rate != SAMPLE_RATE:
            raw, _ = audioop.ratecv(raw, 2, 1, src_rate, SAMPLE_RATE, None)
        return raw
    except ImportError:
        pass

    import struct

    if src_width == 2:
        samples = list(struct.unpack(f"<{len(raw) // 2}h", raw))
    elif src_width == 4:
        float_samples = struct.unpack(f"<{len(raw) // 4}f", raw)
        samples = [max(-32768, min(32767, int(s * 32767))) for s in float_samples]
    elif src_width == 1:
        samples = [(b - 128) * 256 for b in raw]
    else:
        samples = list(struct.unpack(f"<{len(raw) // 2}h", raw))

    if src_channels > 1:
        mono = []
        for i in range(0, len(samples), src_channels):
            ch_samples = samples[i:i + src_channels]
            mono.append(sum(ch_samples) // len(ch_samples))
        samples = mono

    if src_rate != SAMPLE_RATE:
        ratio = SAMPLE_RATE / src_rate
        new_len = int(len(samples) * ratio)
        resampled = [samples[min(int(i / ratio), len(samples) - 1)] for i in range(new_len)]
        samples = resampled

    return struct.pack(f"<{len(samples)}h", *samples)


def _synthesize_to_wav(text: str) -> list[bytes]:
    """Synthesize text to PCM frames. Handles MP3 output from edge-tts."""
    provider = _get_tts_provider()

    if provider == "kittentts":
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
            wav_path = f.name
        try:
            if _synthesize_kittentts(text, wav_path):
                return _read_pcm_frames(wav_path)
        finally:
            try:
                os.unlink(wav_path)
            except OSError:
                pass

    # Edge TTS (default): outputs MP3, convert to WAV via ffmpeg
    mp3_fd, mp3_path = tempfile.mkstemp(suffix=".mp3")
    os.close(mp3_fd)
    wav_fd, wav_path = tempfile.mkstemp(suffix=".wav")
    os.close(wav_fd)
    try:
        if _synthesize_edge(text, mp3_path) and _mp3_to_wav(mp3_path, wav_path):
            return _read_pcm_frames(wav_path)
        return []
    finally:
        for p in (mp3_path, wav_path):
            try:
                os.unlink(p)
            except OSError:
                pass


async def synthesize_to_frames(
    text: str, loop: asyncio.AbstractEventLoop
) -> list[bytes]:
    """Synthesize text and return PCM frames suitable for LiveKit audio track."""
    from tools.tts_tool import _strip_markdown_for_tts

    cleaned = _strip_markdown_for_tts(text)
    if not cleaned:
        return []

    return await loop.run_in_executor(None, lambda: _synthesize_to_wav(cleaned))
