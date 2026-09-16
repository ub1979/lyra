export interface GuidedMergeMessage {
  id: string;
  role: "user" | "assistant" | "error";
  content: string;
  plain?: boolean;
  createdAt?: number;
  /** Sequence number of the model turn that produced an assistant reply. */
  turn?: number;
}

/**
 * A completed reply may refine only the reply of its own turn. Replies from a
 * different turn (a saved-job notification, a follow-up) and quiet notices are
 * separate messages, so one never overwrites another on screen.
 */
export function mergeGuidedResponse<T extends GuidedMergeMessage>(
  messages: readonly T[],
  response: string,
  turn: number,
  now: number,
  id: string = `assistant-${now}-${Math.random().toString(36).slice(2)}`,
): T[] {
  const last = messages[messages.length - 1];
  if (last && last.role === "assistant" && !last.plain && last.turn === turn) {
    return [...messages.slice(0, -1), { ...last, content: response }];
  }
  const appended = {
    id,
    role: "assistant",
    content: response,
    createdAt: now,
    turn,
  } as T;
  return [...messages, appended];
}
