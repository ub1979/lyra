export interface GuidedMergeMessage {
  id: string;
  role: "user" | "assistant" | "error";
  content: string;
  plain?: boolean;
  /** A quiet line that needs attention (e.g. "this reply was not saved"). */
  tone?: "warning";
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
  // A quiet line that belongs to this same turn (the "not saved" warning)
  // sits after the reply; look past it so the reply can still be refined in
  // place. A notice from another turn (a job update) keeps its place and
  // makes the next completion a new bubble, as before.
  let index = messages.length - 1;
  while (index >= 0 && messages[index].plain && messages[index].turn === turn) index -= 1;
  const last = messages[index];
  if (last && last.role === "assistant" && !last.plain && last.turn === turn) {
    return [...messages.slice(0, index), { ...last, content: response }, ...messages.slice(index + 1)];
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
