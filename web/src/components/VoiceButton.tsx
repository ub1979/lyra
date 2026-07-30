import { Mic, MicOff, Loader2 } from "lucide-react";
import { Button } from "@nous-research/ui";
import type { VoiceState } from "../hooks/useLiveKitVoice";

interface VoiceButtonProps {
  state: VoiceState;
  onToggle: () => void;
  disabled?: boolean;
}

export function VoiceButton({ state, onToggle, disabled }: VoiceButtonProps) {
  const isActive = state === "listening";
  const isTransitioning = state === "connecting" || state === "disconnecting";

  return (
    <Button
      size="icon"
      variant={isActive ? "default" : "ghost"}
      onClick={onToggle}
      disabled={disabled || isTransitioning}
      aria-label={isActive ? "Stop voice chat" : "Start voice chat"}
      className={isActive ? "relative" : ""}
    >
      {isTransitioning ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : isActive ? (
        <>
          <span className="absolute inset-0 animate-ping rounded-md bg-current opacity-20" />
          <Mic className="relative h-4 w-4" />
        </>
      ) : (
        <MicOff className="h-4 w-4 opacity-60" />
      )}
    </Button>
  );
}
