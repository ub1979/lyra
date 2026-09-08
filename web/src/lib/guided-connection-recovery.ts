const GUIDED_CONNECTION_ERROR_PREFIX =
  "The project chat could not connect:";
const GUIDED_CONNECTION_ERROR_FALLBACK =
  "The project chat could not connect. Reload and try again.";

/** Native fetch failures during a dashboard restart are temporary transport loss. */
export function isTransientGuidedConnectionSetupError(
  error: unknown,
): boolean {
  if (!(error instanceof TypeError)) return false;
  return /failed to fetch|load failed|network(?:error| request failed)/i.test(
    error.message,
  );
}

/** Remove obsolete connection errors once the saved project chat is open again. */
export function clearRecoveredGuidedConnectionErrors<
  T extends { role: string; content: string },
>(messages: T[]): T[] {
  const recovered = messages.filter(
    (message) =>
      !(
        message.role === "error" &&
        (message.content.startsWith(GUIDED_CONNECTION_ERROR_PREFIX) ||
          message.content === GUIDED_CONNECTION_ERROR_FALLBACK)
      ),
  );
  return recovered.length === messages.length ? messages : recovered;
}
