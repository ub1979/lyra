/**
 * Writing a prompt into the TUI composer over the PTY.
 *
 * Guided chat has no API for sending a message: it types into the Ink composer
 * on the other end of the PTY and then sends a carriage return. That makes the
 * transport character-sensitive in two ways the composer's `<textarea>` hides.
 *
 * 1. Newlines. Shift+Enter inserts them, and the TUI treats a bare newline as
 *    Enter (`textInput.tsx`: `k.return` without a modifier submits). Sending
 *    raw multi-line text therefore submitted the first line as the whole turn
 *    and left the rest arriving as separate messages mid-turn — which is why a
 *    long, structured prompt asking for specialists never reached the agent
 *    intact and it answered the opening line alone.
 * 2. The trailing Enter raced the payload. A fixed 80ms is fine for a sentence
 *    and not for a few thousand characters, where the tail could still be in
 *    flight and become a second message.
 *
 * Both are fixed by using bracketed paste, which the TUI already understands
 * (`inp.includes('[200~')` routes to its atomic paste path, and
 * `stripTrailingPasteNewlines` keeps a paste from self-submitting), and by
 * scaling the Enter delay with payload size.
 */

const BRACKETED_PASTE_START = "\u001b[200~";
const BRACKETED_PASTE_END = "\u001b[201~";

/**
 * Single-line prompts shorter than this keep the previous plain-typing path.
 * The TUI's paste path also runs drag-and-drop detection on pasted text
 * (`looksLikeDroppedPath`), so short one-liners are left exactly as they were.
 */
export const GUIDED_BRACKETED_PASTE_MIN_LENGTH = 200;

const ENTER_DELAY_FLOOR_MS = 80;
const ENTER_DELAY_CEILING_MS = 600;
const ENTER_DELAY_PER_KB_MS = 40;

/**
 * Remove anything the terminal reads as a key rather than as text: carriage
 * returns (they submit), nested paste markers (they would end the paste early,
 * dumping the remainder as keystrokes), and other C0 controls. Tabs and
 * newlines are kept — inside a bracketed paste they are literal.
 */
export function sanitizeGuidedComposerText(text: string): string {
  return (
    text
      .replace(/\r\n?/g, "\n")
      // eslint-disable-next-line no-control-regex
      .replace(/\u001b\[20[01]~/g, "")
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
      // A trailing newline buys nothing: the TUI strips it from a paste, and
      // keeping it would push a plain one-liner onto the paste path for no
      // reason.
      .replace(/\n+$/, "")
  );
}

/** True when the text must be pasted rather than typed. */
export function guidedNeedsBracketedPaste(text: string): boolean {
  return (
    text.includes("\n") || text.length >= GUIDED_BRACKETED_PASTE_MIN_LENGTH
  );
}

/** The exact bytes to write to the PTY for *text*. */
export function guidedComposerPayload(text: string): string {
  const body = sanitizeGuidedComposerText(text);
  if (!guidedNeedsBracketedPaste(body)) return body;
  return `${BRACKETED_PASTE_START}${body}${BRACKETED_PASTE_END}`;
}

/** How long to wait before the Enter that submits a payload of this size. */
export function guidedComposerEnterDelayMs(payloadLength: number): number {
  const scaled =
    ENTER_DELAY_FLOOR_MS +
    Math.floor(payloadLength / 1000) * ENTER_DELAY_PER_KB_MS;
  return Math.min(
    ENTER_DELAY_CEILING_MS,
    Math.max(ENTER_DELAY_FLOOR_MS, scaled),
  );
}

export type GuidedComposerTransport = {
  /** Write to the PTY. */
  send: (data: string) => void;
  /** False once the socket has gone away — then the Enter is skipped. */
  isOpen: () => boolean;
  /** Deferred callback (window.setTimeout in the app). */
  schedule: (run: () => void, delayMs: number) => void;
};

/**
 * Write *text* into the composer and submit it.
 *
 * Returns the payload that was written, so callers and tests can assert on it.
 */
export function writeGuidedPrompt(
  text: string,
  transport: GuidedComposerTransport,
): string {
  const payload = guidedComposerPayload(text);
  transport.send(payload);
  transport.schedule(() => {
    if (!transport.isOpen()) return;
    transport.send("\r");
  }, guidedComposerEnterDelayMs(payload.length));
  return payload;
}
