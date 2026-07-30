"""STT bridge: collect LiveKit audio frames → transcribe via existing STT."""

from __future__ import annotations

import asyncio
import io
import logging
import struct
import tempfile
import wave
from typing import Optional

logger = logging.getLogger(__name__)

SAMPLE_RATE = 16000
CHANNELS = 1
SAMPLE_WIDTH = 2  # int16


class VoiceActivityBuffer:
    """Collects raw PCM frames and produces a WAV file for transcription.

    Simple energy-based VAD: accumulates audio while above threshold,
    transcribes after a silence gap.
    """

    def __init__(
        self,
        *,
        sample_rate: int = SAMPLE_RATE,
        silence_threshold: float = 500.0,
        silence_duration_ms: int = 1200,
        min_speech_ms: int = 400,
    ):
        self._sample_rate = sample_rate
        self._silence_threshold = silence_threshold
        self._silence_samples = int(sample_rate * silence_duration_ms / 1000)
        self._min_speech_samples = int(sample_rate * min_speech_ms / 1000)
        self._buffer = bytearray()
        self._silence_count = 0
        self._speech_started = False
        self._logged_energy = False

    def feed(self, pcm_data: bytes) -> Optional[bytes]:
        """Feed raw int16 PCM. Returns WAV bytes when a speech segment ends."""
        n_samples = len(pcm_data) // SAMPLE_WIDTH
        if n_samples == 0:
            return None

        samples = struct.unpack(f"<{n_samples}h", pcm_data[:n_samples * SAMPLE_WIDTH])
        energy = sum(abs(s) for s in samples) / n_samples

        if not self._speech_started and not self._logged_energy:
            logger.debug("VAD energy sample: %.1f (threshold: %.1f)", energy, self._silence_threshold)
            self._logged_energy = True

        if energy > self._silence_threshold:
            self._speech_started = True
            self._silence_count = 0
            self._buffer.extend(pcm_data)
        elif self._speech_started:
            self._silence_count += n_samples
            self._buffer.extend(pcm_data)
            if self._silence_count >= self._silence_samples:
                speech_samples = len(self._buffer) // SAMPLE_WIDTH
                if speech_samples >= self._min_speech_samples:
                    wav = self._to_wav(bytes(self._buffer))
                    self._reset()
                    return wav
                self._reset()
        return None

    def _reset(self):
        self._buffer.clear()
        self._silence_count = 0
        self._speech_started = False
        self._logged_energy = False

    def _to_wav(self, pcm: bytes) -> bytes:
        buf = io.BytesIO()
        with wave.open(buf, "wb") as wf:
            wf.setnchannels(CHANNELS)
            wf.setsampwidth(SAMPLE_WIDTH)
            wf.setframerate(self._sample_rate)
            wf.writeframes(pcm)
        return buf.getvalue()


async def transcribe_wav(wav_data: bytes, loop: asyncio.AbstractEventLoop) -> Optional[str]:
    """Write WAV to temp file and run transcription in executor."""
    def _do_transcribe():
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
            f.write(wav_data)
            f.flush()
            tmp_path = f.name

        try:
            from tools.transcription_tools import transcribe_audio
            result = transcribe_audio(tmp_path)
            if result.get("success"):
                return result.get("transcript", "").strip()
            logger.warning("STT failed: %s", result.get("error", "unknown"))
            return None
        finally:
            import os
            try:
                os.unlink(tmp_path)
            except OSError:
                pass

    return await loop.run_in_executor(None, _do_transcribe)
