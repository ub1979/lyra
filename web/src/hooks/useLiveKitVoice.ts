import { useCallback, useEffect, useRef, useState } from "react";
import {
  Room,
  RoomEvent,
  Track,
  RemoteTrackPublication,
  RemoteParticipant,
  ConnectionState,
  DataPacket_Kind,
} from "livekit-client";
import { fetchJSON } from "../lib/api";

export type VoiceState =
  | "idle"
  | "connecting"
  | "listening"
  | "disconnecting";

interface UseLiveKitVoiceOptions {
  channelId: string;
  onTranscript: (text: string) => void;
}

export function useLiveKitVoice({
  channelId,
  onTranscript,
}: UseLiveKitVoiceOptions) {
  const [state, setState] = useState<VoiceState>("idle");
  const roomRef = useRef<Room | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;

  const connect = useCallback(async () => {
    if (roomRef.current || state !== "idle") return;
    setState("connecting");

    try {
      await fetchJSON("/api/voice/worker-start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId }),
      });

      const { token, wsUrl, roomName } = await fetchJSON<{
        token: string;
        wsUrl: string;
        roomName: string;
      }>("/api/voice/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId }),
      });

      const room = new Room();
      roomRef.current = room;

      room.on(RoomEvent.DataReceived, (payload: Uint8Array) => {
        try {
          const msg = JSON.parse(new TextDecoder().decode(payload));
          if (msg.type === "transcript" && msg.text) {
            onTranscriptRef.current(msg.text);
          }
        } catch {
          // ignore non-JSON data
        }
      });

      room.on(
        RoomEvent.TrackSubscribed,
        (
          track: Track,
          _pub: RemoteTrackPublication,
          _participant: RemoteParticipant,
        ) => {
          if (track.kind === Track.Kind.Audio) {
            if (!audioRef.current) {
              audioRef.current = document.createElement("audio");
              audioRef.current.autoplay = true;
            }
            track.attach(audioRef.current);
          }
        },
      );

      room.on(
        RoomEvent.TrackUnsubscribed,
        (track: Track) => {
          if (audioRef.current) {
            track.detach(audioRef.current);
          }
        },
      );

      room.on(RoomEvent.Disconnected, () => {
        setState("idle");
        roomRef.current = null;
      });

      await room.connect(wsUrl, token);

      await room.localParticipant.setMicrophoneEnabled(true, {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      });

      setState("listening");
    } catch (err) {
      console.error("Voice connection failed:", err);
      setState("idle");
      roomRef.current = null;
    }
  }, [channelId, state]);

  const disconnect = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;

    setState("disconnecting");
    try {
      await room.disconnect();
    } catch {
      // already disconnected
    }

    if (audioRef.current) {
      audioRef.current.srcObject = null;
      audioRef.current = null;
    }

    roomRef.current = null;
    setState("idle");

    try {
      await fetchJSON("/api/voice/worker-stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId }),
      });
    } catch {
      // best effort
    }
  }, [channelId]);

  const toggle = useCallback(() => {
    if (state === "idle") {
      connect();
    } else if (state === "listening") {
      disconnect();
    }
  }, [state, connect, disconnect]);

  useEffect(() => {
    return () => {
      const room = roomRef.current;
      if (room && room.state !== ConnectionState.Disconnected) {
        room.disconnect();
      }
    };
  }, []);

  return { state, toggle, connect, disconnect };
}
