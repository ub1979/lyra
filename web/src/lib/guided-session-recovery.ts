import type { SessionMessage } from "@/lib/api";

import { sanitizeGuidedResponse } from "@/lib/guided-chat-output";

export interface RecoveredGuidedMessage {
  id: string;
  role: "user" | "assistant" | "error";
  content: string;
  plain?: boolean;
  createdAt?: number;
}

const SYNTHETIC_USER_PREFIXES = [
  "IDRAK_INTERNAL_PROJECT_TASK_UPDATE:",
  "IDRAK_INTERNAL_CONTINUE:",
  "IDRAK_INTERNAL_SKILLS_UPDATE_BEGIN",
  "IDRAK_INTERNAL_SETUP_BEGIN",
];

const ROUTING_LINE = /^IDRAK_INTERNAL_(?:PLAIN_LANGUAGE|MODEL_ROUTING|REQUIREMENTS_ROUTING):/;
const COMPACTED_SETUP_LINE = /^\[\[\s*IDRAK_INTERNAL_S\.\./;

function recoveredMessageTime(timestamp: number | undefined): number | undefined {
  if (typeof timestamp !== "number" || !Number.isFinite(timestamp)) return undefined;
  return timestamp < 1_000_000_000_000 ? timestamp * 1000 : timestamp;
}

/**
 * Recover text the person actually typed from a stored guided turn.
 *
 * Guided Studio prepends stable routing lines to each user turn. Saved project
 * notifications and automatic continuations also use the user role so the
 * model message sequence remains valid, but they are transport, not chat.
 */
export function recoverGuidedUserContent(raw: string): string {
  const text = raw.trim();
  if (!text) return "";
  if (SYNTHETIC_USER_PREFIXES.some((prefix) => text.startsWith(prefix))) {
    return "";
  }

  return text
    .split(/\r?\n/)
    .filter((line) => !ROUTING_LINE.test(line.trim()))
    .filter((line) => !COMPACTED_SETUP_LINE.test(line.trim()))
    .join("\n")
    .trim();
}

/**
 * Return the smallest trustworthy recovery tail for a fresh Studio page.
 *
 * The browser's live transcript remains the richer source while a page is
 * open. On a fresh browser, the canonical session can contain thousands of
 * tool and orchestration rows that were never chat bubbles. Restoring only the
 * latest real reply (or the latest unanswered user turn) makes the active
 * question recoverable without reinterpreting internal history as UI.
 */
export function recoverGuidedSessionTail(
  messages: readonly SessionMessage[],
): RecoveredGuidedMessage[] {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role === "assistant" && typeof message.content === "string") {
      const content = sanitizeGuidedResponse(message.content);
      if (!content) continue;
      return [
        {
          id: `session-assistant-${message.id ?? index}`,
          role: "assistant",
          content,
          createdAt: recoveredMessageTime(message.timestamp),
        },
      ];
    }
    if (message.role === "user" && typeof message.content === "string") {
      const content = recoverGuidedUserContent(message.content);
      if (!content) continue;
      const id = `session-user-${message.id ?? index}`;
      return [
        {
          id,
          role: "user",
          content,
          createdAt: recoveredMessageTime(message.timestamp),
        },
        {
          id: `recovered-error-${id}`,
          role: "error",
          content:
            "The previous attempt ended without a response. You can retry it when ready.",
          createdAt: Date.now(),
        },
      ];
    }
  }
  return [];
}

/** Add a newer canonical reply without clobbering richer browser history. */
export function mergeRecoveredGuidedSessionTail(
  current: readonly RecoveredGuidedMessage[],
  recovered: readonly RecoveredGuidedMessage[],
): RecoveredGuidedMessage[] {
  if (!recovered.length) return [...current];
  const latest = recovered[recovered.length - 1];
  if (latest.role !== "assistant") {
    return current.length ? [...current] : [...recovered];
  }
  if (
    current.some(
      (message) =>
        message.role === "assistant" && message.content === latest.content,
    )
  ) {
    return [...current];
  }
  const withoutStaleRecoveryError =
    current[current.length - 1]?.role === "error" &&
    current[current.length - 1]?.id.startsWith("recovered-error-")
      ? current.slice(0, -1)
      : current;
  return [...withoutStaleRecoveryError, latest];
}
