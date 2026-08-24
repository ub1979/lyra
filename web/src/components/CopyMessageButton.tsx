import { Check, Copy, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  COPY_FEEDBACK_MS,
  type CopyState,
  copyButtonLabel,
} from "@/lib/chat-copy";
import { copyTextToClipboard } from "@/lib/clipboard";
import { cn } from "@/lib/utils";

interface CopyMessageButtonProps {
  /** Exact text to place on the clipboard. */
  text: string;
  /** Who wrote the message — used for the accessible label ("Lyra", "your"). */
  roleLabel: string;
  className?: string;
}

/**
 * The copy control on a chat bubble.
 *
 * Kept deliberately quiet: transparent until the bubble is hovered or the
 * button is focused, so a transcript still reads as a conversation rather than
 * a row of toolbars. On touch there is no hover, so it stays visible — a
 * control you cannot reveal is a control that does not exist.
 *
 * ``copyTextToClipboard`` already falls back to a hidden-textarea
 * ``execCommand`` copy when the async clipboard API is unavailable (http on a
 * LAN address, an older WebView). When even that fails the button says so
 * instead of pretending it worked, because a silent no-op is worse than no
 * button at all.
 */
export function CopyMessageButton({
  text,
  roleLabel,
  className,
}: CopyMessageButtonProps) {
  const [state, setState] = useState<CopyState>("idle");
  const timerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    },
    [],
  );

  const handleCopy = useCallback(async () => {
    const copied = await copyTextToClipboard(text);
    setState(copied ? "copied" : "failed");
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      setState("idle");
      timerRef.current = null;
    }, COPY_FEEDBACK_MS);
  }, [text]);

  const label = copyButtonLabel(state, roleLabel);
  const Icon = state === "copied" ? Check : state === "failed" ? X : Copy;

  return (
    <button
      type="button"
      onClick={() => void handleCopy()}
      title={label}
      aria-label={label}
      className={cn(
        "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md",
        "opacity-0 transition-opacity duration-150",
        "hover:bg-current/10 focus-visible:opacity-100 focus-visible:outline-none",
        "focus-visible:ring-2 focus-visible:ring-current/40",
        "group-hover:opacity-100 group-focus-within:opacity-100",
        // No hover on touch: the control would otherwise be unreachable.
        "[@media(hover:none)]:opacity-100",
        state !== "idle" && "opacity-100",
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {/* Announce the outcome to screen readers, which cannot see the tick. */}
      <span className="sr-only" role="status" aria-live="polite">
        {state === "copied" ? "Copied" : state === "failed" ? "Copy failed" : ""}
      </span>
    </button>
  );
}
