import { describe, expect, it } from 'vitest'

import { EMPTY_GUIDED_USAGE } from './guided-agent-runtime'
import { readGuidedUsageCache, writeGuidedUsageCache } from './guided-usage-cache'

describe('saved coordinator usage', () => {
  it('restores only the same workspace and conversation', () => {
    const values = new Map<string, string>()
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value) }
    }
    const usage = { ...EMPTY_GUIDED_USAGE, reported: true, input: 234, output: 0, updatedAt: 17 }
    writeGuidedUsageCache(storage, '/project-a', 'session-1', usage)
    expect(readGuidedUsageCache(storage, '/project-a', 'session-1')).toEqual(usage)
    expect(readGuidedUsageCache(storage, '/project-a', 'session-2')).toBeNull()
    expect(readGuidedUsageCache(storage, '/project-b', 'session-1')).toBeNull()
    writeGuidedUsageCache(storage, '/project-a', 'session-1', EMPTY_GUIDED_USAGE)
    expect(readGuidedUsageCache(storage, '/project-a', 'session-1')).toEqual(usage)
  })
})
