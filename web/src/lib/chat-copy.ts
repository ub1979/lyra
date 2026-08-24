/**
 * What a chat bubble puts on the clipboard.
 *
 * Selecting a bubble by hand is unreliable — the message body, the "YOU" /
 * "LYRA" label, the phase strip and the approval buttons all live in the same
 * rounded box, so a drag either grabs chrome along with the text or, on touch,
 * scrolls the transcript instead of selecting. A per-message copy button is
 * the only way to get exactly one message.
 *
 * Lyra's replies copy as their **original markdown**, not as the rendered
 * text: `- item`, `**bold**` and fenced code survive the round-trip into an
 * editor, another chat, or a bug report. Rendering to plain text would quietly
 * destroy the structure of the very thing people copy most — code.
 *
 * Two things are stripped on the way out, because they are protocol rather
 * than prose and are meaningless outside this app:
 *
 * - `[APP_IT_PHASE:…]` / `[APP_IT_PHASE_DONE:…]` / `[APP_IT_SKILLS_SET:…]` —
 *   the control markers that drive the phase chain. The renderer already
 *   removes them, so this is belt-and-braces for anything stored before a
 *   stripper existed, or a marker that arrives inside a code fence.
 * - `[[IDRAK_MODEL_CONNECTION_ERROR]]` — an internal sentinel on error bubbles.
 */

const CONTROL_MARKERS = [
  /\[APP_IT_PHASE_DONE:[^\]]*\]/gi,
  /\[APP_IT_PHASE:[^\]]*\]/gi,
  /\[APP_IT_SKILLS_SET:[^\]]*\]/gi,
  /\[\[IDRAK_MODEL_CONNECTION_ERROR\]\]/gi,
];

export type CopyableMessage = {
  role: "user" | "assistant" | "error";
  content: string;
};

/**
 * The exact text to place on the clipboard for *message*.
 *
 * Returns an empty string when there is nothing worth copying, so callers can
 * hide the button rather than offer a copy that silently yields whitespace.
 */
export function chatMessageCopyText(message: CopyableMessage): string {
  let text = message.content ?? "";
  for (const marker of CONTROL_MARKERS) {
    text = text.replace(marker, "");
  }
  // Collapse the blank lines a stripped marker leaves behind, without
  // touching deliberate paragraph breaks inside the message.
  return text
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Whether a bubble should offer a copy button at all. */
export function chatMessageIsCopyable(message: CopyableMessage): boolean {
  return chatMessageCopyText(message).length > 0;
}

export type CopyState = "idle" | "copied" | "failed";

/** How long the confirmation tick stays up before reverting to the icon. */
export const COPY_FEEDBACK_MS = 1600;

/** Accessible label for the button in each state. */
export function copyButtonLabel(state: CopyState, roleLabel: string): string {
  if (state === "copied") return "Copied";
  if (state === "failed") return "Copy failed — select the text manually";
  return `Copy ${roleLabel} message`;
}
