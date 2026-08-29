const GUIDED_PROJECT_SESSION_KEY_PREFIX = "idrak-it.guided-session.v1:";

interface GuidedProjectSessionCandidate {
  cwd?: string | null;
  id?: string | null;
  message_count?: number | null;
  parent_session_id?: string | null;
  source?: string | null;
}

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

export function selectGuidedProjectSessionId(
  sessions: readonly GuidedProjectSessionCandidate[],
  workspace: string,
  preferredId = "",
): string {
  const matching = sessions.filter(
    (session) =>
      session.cwd === workspace && Boolean(session.id?.trim()),
  );
  const projectChats = matching.filter(
    (session) =>
      session.source !== "subagent" && !session.parent_session_id?.trim(),
  );
  const candidates = projectChats.length ? projectChats : matching;
  const preferred = preferredId.trim();
  if (preferred) {
    const saved = candidates.find(
      (session) => session.id?.trim() === preferred,
    );
    if (saved) return preferred;
  }
  return (
    [...candidates]
      .sort(
        (left, right) =>
          (right.message_count ?? 0) - (left.message_count ?? 0),
      )[0]
      ?.id?.trim() ?? ""
  );
}
