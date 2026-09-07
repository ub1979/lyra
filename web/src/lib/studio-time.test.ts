import { describe, expect, it } from 'vitest'
import { formatStudioDateTime, studioDateTimeIso, studioMessageTime } from './studio-time'

describe('Studio message time', () => {
  it('prefers an explicit saved timestamp', () => {
    expect(studioMessageTime({ id: 'user-1700000000000-x', createdAt: 1700000000123 })).toBe(1700000000123)
  })

  it('recovers legacy timestamp IDs without inventing a time', () => {
    expect(studioMessageTime({ id: 'assistant-1700000000000-x' })).toBe(1700000000000)
    expect(studioMessageTime({ id: 'clarify-random' })).toBeNull()
  })

  it('formats a complete local date and time', () => {
    const timestamp = Date.UTC(2026, 8, 7, 10, 5)
    expect(formatStudioDateTime(timestamp, 'en-GB', 'Europe/London')).toBe('7 Sept 2026, 11:05')
    expect(studioDateTimeIso(timestamp)).toBe('2026-09-07T10:05:00.000Z')
  })
})
