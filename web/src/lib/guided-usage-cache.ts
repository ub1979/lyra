import type { GuidedUsageSnapshot } from './guided-agent-runtime'

/** Last reported coordinator counters for one saved conversation. */
const key = (workspace: string, sessionId: string) =>
  `idrak-it.guided-usage.v1:${encodeURIComponent(workspace)}:${encodeURIComponent(sessionId)}`

export function readGuidedUsageCache(
  storage: Pick<Storage, 'getItem'>,
  workspace: string,
  sessionId: string
): GuidedUsageSnapshot | null {
  if (!workspace || !sessionId) return null
  try {
    const raw = storage.getItem(key(workspace, sessionId))
    if (!raw) return null
    const value = JSON.parse(raw) as GuidedUsageSnapshot
    return value?.reported === true &&
      Number.isFinite(value.input) && Number.isFinite(value.output) &&
      Number.isFinite(value.updatedAt) ? value : null
  } catch {
    return null
  }
}

export function writeGuidedUsageCache(
  storage: Pick<Storage, 'setItem'>,
  workspace: string,
  sessionId: string,
  usage: GuidedUsageSnapshot
): void {
  if (!workspace || !sessionId || !usage.reported) return
  try {
    storage.setItem(key(workspace, sessionId), JSON.stringify(usage))
  } catch {
    // Quota or disabled storage must not interrupt the conversation.
  }
}
