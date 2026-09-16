import type { GuidedMergeMessage } from "./guided-response-merge";

/** One quiet, amber line under a reply: the gateway's word that it was not saved. */
export interface GuidedReplyWarning extends GuidedMergeMessage {
  role: "assistant";
  plain: true;
  tone: "warning";
  createdAt: number;
}

/**
 * A `message.complete` frame may carry `warning` — today the only one is
 * "History changed during this turn — the response above is visible but was
 * not saved to session history." The reply itself still renders; this becomes
 * a separate line keyed by turn, so a second completion of the same turn does
 * not repeat it and a later reply cannot overwrite it (it is `plain`).
 */
export function guidedReplyWarning(
  payload: unknown,
  turn: number,
  now: number,
): GuidedReplyWarning | null {
  if (!payload || typeof payload !== "object") return null;
  const warning = (payload as Record<string, unknown>).warning;
  if (typeof warning !== "string" || !warning.trim()) return null;
  return {
    id: `reply-warning-${turn}`,
    role: "assistant",
    content: warning.trim(),
    plain: true,
    tone: "warning",
    turn,
    createdAt: now,
  };
}
