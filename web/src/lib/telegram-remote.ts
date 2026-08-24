import type { MessagingPlatform } from '@/lib/api'

export type TelegramRemoteReadiness = 'connect' | 'set-home' | 'start-gateway' | 'ready'

/**
 * Translate the generic Channels-page platform state into the four states the
 * guided builder needs. Keeping this pure makes the contract explicit: a bot
 * token alone is not remote control — handoff also needs a destination and a
 * live gateway process.
 */
export function telegramRemoteReadiness(platform: MessagingPlatform | null | undefined): TelegramRemoteReadiness {
  if (!platform?.configured || !platform.enabled) return 'connect'
  if (!platform.home_channel?.chat_id) return 'set-home'
  if (!platform.gateway_running || platform.state !== 'connected') {
    return 'start-gateway'
  }
  return 'ready'
}

export function telegramRemoteButtonLabel(readiness: TelegramRemoteReadiness): string {
  if (readiness === 'ready') return 'Continue on Telegram'
  if (readiness === 'start-gateway') return 'Start Telegram remote'
  if (readiness === 'set-home') return 'Choose Telegram phone'
  return 'Connect phone'
}

export function telegramRemoteHint(readiness: TelegramRemoteReadiness): string {
  if (readiness === 'ready') {
    return 'Move this project conversation to Telegram and receive phone notifications when Lyra needs you.'
  }
  if (readiness === 'start-gateway') {
    return 'Telegram is configured, but its gateway is not connected yet.'
  }
  if (readiness === 'set-home') {
    return 'Open the bot in Telegram and send /sethome so Lyra knows which phone chat to use.'
  }
  return 'Connect a private Telegram bot to control this project from your phone.'
}
