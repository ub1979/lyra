import type { GuidedChatPresentation } from "./guided-chat-output";

/** Merge terminal paint only while it owns the conversation's fallback UI. */
export function terminalPresentation(
  current: GuidedChatPresentation,
  snapshot: GuidedChatPresentation,
  structuredFeedEstablished: boolean,
  turnSettled: boolean,
): GuidedChatPresentation {
  // Once established, structured events own every phase, including idle.
  // Terminal paint is not a new turn-state event, even during reconnect.
  if (structuredFeedEstablished || turnSettled) return current;
  return snapshot;
}
