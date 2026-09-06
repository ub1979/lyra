import { describe, expect, it } from 'vitest'
import {
  LEGACY_GUIDED_MODEL_STORAGE_KEY,
  guidedModelPreferenceKey,
  guidedModelProviders,
  readGuidedModelPreferences,
  writeGuidedModelPreferences
} from './guided-agent-model-preferences'

class MemoryStorage {
  values = new Map<string, string>()
  getItem(key: string) { return this.values.get(key) ?? null }
  removeItem(key: string) { this.values.delete(key) }
  setItem(key: string, value: string) { this.values.set(key, value) }
}

describe('guided agent model preferences', () => {
  it('isolates assignments by project and provider', () => {
    const storage = new MemoryStorage()
    writeGuidedModelPreferences(storage, '/projects/song', 'ollama-local', {
      researcher: 'glm-5-2:cloud'
    })

    expect(readGuidedModelPreferences(storage, '/projects/song', 'ollama-local', ['researcher'])).toEqual({
      researcher: 'glm-5-2:cloud'
    })
    expect(readGuidedModelPreferences(storage, '/projects/song', 'claude-cli', ['researcher'])).toEqual({})
    expect(readGuidedModelPreferences(storage, '/projects/other', 'ollama-local', ['researcher'])).toEqual({})
  })

  it('does not trust the legacy provider-less value', () => {
    const storage = new MemoryStorage()
    storage.setItem(LEGACY_GUIDED_MODEL_STORAGE_KEY, JSON.stringify({ researcher: 'glm-5-2:cloud' }))

    expect(readGuidedModelPreferences(storage, '/projects/song', 'claude-cli', ['researcher'])).toEqual({})
    writeGuidedModelPreferences(storage, '/projects/song', 'claude-cli', {})
    expect(storage.getItem(LEGACY_GUIDED_MODEL_STORAGE_KEY)).toBeNull()
  })

  it('binds every explicit model to the confirmed provider', () => {
    expect(guidedModelProviders({ researcher: 'claude-sonnet-4-6', debugger: '' }, 'claude-cli')).toEqual({
      researcher: 'claude-cli'
    })
    expect(guidedModelProviders({ researcher: 'claude-sonnet-4-6' }, '')).toEqual({})
  })

  it('requires both workspace and provider for a persistence key', () => {
    expect(guidedModelPreferenceKey('', 'claude-cli')).toBeNull()
    expect(guidedModelPreferenceKey('/projects/song', '')).toBeNull()
  })
})
