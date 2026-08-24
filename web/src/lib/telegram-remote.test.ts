import { describe, expect, it } from 'vitest'

import type { MessagingPlatform } from '@/lib/api'
import { telegramRemoteButtonLabel, telegramRemoteReadiness } from './telegram-remote'

function platform(overrides: Partial<MessagingPlatform> = {}): MessagingPlatform {
  return {
    configured: true,
    description: 'Telegram',
    docs_url: '',
    enabled: true,
    env_vars: [],
    error_code: null,
    error_message: null,
    gateway_running: true,
    home_channel: {
      chat_id: '123456789',
      name: 'Telegram phone',
      platform: 'telegram'
    },
    id: 'telegram',
    name: 'Telegram',
    state: 'connected',
    updated_at: null,
    ...overrides
  }
}

describe('telegramRemoteReadiness', () => {
  it('requires credentials and enablement before offering handoff', () => {
    expect(telegramRemoteReadiness(null)).toBe('connect')
    expect(telegramRemoteReadiness(platform({ configured: false }))).toBe('connect')
    expect(telegramRemoteReadiness(platform({ enabled: false }))).toBe('connect')
  })

  it('requires a phone destination after configuration', () => {
    expect(telegramRemoteReadiness(platform({ home_channel: null }))).toBe('set-home')
  })

  it('requires the gateway to be connected', () => {
    expect(telegramRemoteReadiness(platform({ gateway_running: false }))).toBe('start-gateway')
    expect(telegramRemoteReadiness(platform({ state: 'pending_restart' }))).toBe('start-gateway')
  })

  it('offers the phone handoff only when the full route is ready', () => {
    expect(telegramRemoteReadiness(platform())).toBe('ready')
    expect(telegramRemoteButtonLabel('ready')).toBe('Continue on Telegram')
  })
})
