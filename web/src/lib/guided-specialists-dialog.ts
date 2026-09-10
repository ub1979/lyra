import { cn } from "@/lib/utils";
import type { CSSProperties } from "react";

/**
 * Geometry for the guided-chat "Project specialists" dialog.
 *
 * These class strings are load-bearing and therefore covered by tests: ticking
 * or unticking a specialist must not change the height of anything. When it
 * did, the panel (sized from its content) grew, the centred overlay re-centred
 * it, the card's grid row resized, the list's scrollHeight changed and the
 * user's click landed somewhere else than where they aimed.
 */

/**
 * Fixed height — deliberately `h-`, never a content-driven `max-h-[...]`. A
 * content-driven height makes the panel resize whenever a card changes size,
 * which moves the header off the top of the viewport and shifts the list under
 * the pointer.
 *
 * `max-h-full` clamps it to the overlay's padded box. Without it, a short
 * window (88dvh + the overlay's 2×1.5rem padding > 100dvh below roughly 400px
 * of viewport) makes the centred panel overflow at both ends, and the header
 * ends up above the top of the screen where it cannot be scrolled back to.
 */
export const GUIDED_SPECIALISTS_PANEL =
  "lyra-studio-agent-dialog relative z-[71] flex h-[88dvh] max-h-full w-full max-w-5xl flex-col overflow-hidden " +
  "rounded-2xl border border-current/20 bg-background-base text-text-primary shadow-2xl";

/**
 * Chrome on macOS can lose the painted contents of an already-scrolled
 * overflow layer when a checkbox rerenders its cards. The DOM and accessibility
 * tree remain correct, but the user sees a blank panel until another scroll.
 * A compositor layer on the scroll area gives those updates their own paint
 * invalidation without moving the list or changing dialog geometry.
 */
export const GUIDED_SPECIALISTS_SCROLL_LAYER_STYLE: CSSProperties = {
  transform: "translateZ(0)",
};

/**
 * The per-card LLM row. Rendered for every card in both states — only its
 * opacity differs — so a card's height is the same selected and unselected.
 */
export function guidedSpecialistModelRowClass(selected: boolean): string {
  return cn(
    "lyra-studio-agent-model-row mt-3 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2 border-t border-current/10 pt-3 transition-opacity",
    selected ? "opacity-100" : "opacity-40",
  );
}
