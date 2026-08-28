const GUIDED_PROJECT_SESSION_KEY_PREFIX = "idrak-it.guided-session.v1:";

export function guidedProjectSessionStorageKey(workspace: string): string {
  return `${GUIDED_PROJECT_SESSION_KEY_PREFIX}${workspace || "default"}`;
}

export function readGuidedProjectSessionId(workspace: string): string {
  try {
    return (
      globalThis.localStorage
        .getItem(guidedProjectSessionStorageKey(workspace))
        ?.trim() ?? ""
    );
  } catch {
    return "";
  }
}

export function writeGuidedProjectSessionId(
  workspace: string,
  sessionId: string,
): void {
  const normalized = sessionId.trim();
  if (!normalized) return;
  try {
    globalThis.localStorage.setItem(
      guidedProjectSessionStorageKey(workspace),
      normalized,
    );
  } catch {
    // Conversation remains usable when browser storage is unavailable.
  }
}

export function clearGuidedProjectSessionId(workspace: string): void {
  try {
    globalThis.localStorage.removeItem(guidedProjectSessionStorageKey(workspace));
  } catch {
    // A fresh in-memory conversation can still start without browser storage.
  }
}
