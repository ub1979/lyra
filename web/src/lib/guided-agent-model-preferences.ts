export interface GuidedModelPreferenceStorage {
  getItem(key: string): string | null
  removeItem(key: string): void
  setItem(key: string, value: string): void
}

const STORAGE_PREFIX = 'idrak-it.builder.skill-models.v2'
export const LEGACY_GUIDED_MODEL_STORAGE_KEY = 'idrak-it.builder.skill-models.v1'

export function guidedModelPreferenceKey(workspace: string, provider: string): string | null {
  const project = workspace.trim()
  const owner = provider.trim()
  if (!project || !owner) return null
  return `${STORAGE_PREFIX}:${encodeURIComponent(owner)}:${encodeURIComponent(project)}`
}

/** Read only assignments owned by this exact project/provider pair. */
export function readGuidedModelPreferences(
  storage: GuidedModelPreferenceStorage,
  workspace: string,
  provider: string,
  allowedAgentIds: readonly string[]
): Record<string, string> {
  const key = guidedModelPreferenceKey(workspace, provider)
  if (!key) return {}
  try {
    const value = JSON.parse(storage.getItem(key) ?? '{}') as unknown
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
    return Object.fromEntries(
      Object.entries(value).filter(
        (entry): entry is [string, string] =>
          allowedAgentIds.includes(entry[0]) &&
          typeof entry[1] === 'string' &&
          Boolean(entry[1].trim())
      )
    )
  } catch {
    return {}
  }
}

export function writeGuidedModelPreferences(
  storage: GuidedModelPreferenceStorage,
  workspace: string,
  provider: string,
  models: Readonly<Record<string, string>>
): void {
  const key = guidedModelPreferenceKey(workspace, provider)
  if (!key) return
  storage.setItem(key, JSON.stringify(models))
  // The v1 value has no provider or project identity. Keeping it active can
  // silently attach an Ollama model to Claude after a machine/provider move.
  storage.removeItem(LEGACY_GUIDED_MODEL_STORAGE_KEY)
}

/** A model override and its provider are one atomic routing decision. */
export function guidedModelProviders(
  models: Readonly<Record<string, string>>,
  provider: string
): Record<string, string> {
  const owner = provider.trim()
  if (!owner) return {}
  return Object.fromEntries(
    Object.entries(models)
      .filter(([, model]) => Boolean(model.trim()))
      .map(([agentId]) => [agentId, owner])
  )
}
