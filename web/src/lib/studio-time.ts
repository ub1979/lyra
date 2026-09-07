const TIMESTAMP_IN_ID = /(?:^|-)(\d{13})(?:-|$)/
const EARLIEST_REASONABLE_TIME = Date.UTC(2000, 0, 1)

/** Recover the original time from current messages and legacy timestamp IDs. */
export function studioMessageTime(message: { id: string; createdAt?: unknown }): number | null {
  const explicit = Number(message.createdAt)
  if (Number.isFinite(explicit) && explicit >= EARLIEST_REASONABLE_TIME) return explicit
  const match = message.id.match(TIMESTAMP_IN_ID)
  if (!match) return null
  const fromId = Number(match[1])
  return Number.isFinite(fromId) && fromId >= EARLIEST_REASONABLE_TIME ? fromId : null
}

/** User-local date and time; the browser supplies locale and time zone. */
export function formatStudioDateTime(
  timestampMs: number | null,
  locales?: Intl.LocalesArgument,
  timeZone?: string
): string {
  if (timestampMs === null || !Number.isFinite(timestampMs)) return 'Time unavailable'
  return new Intl.DateTimeFormat(locales, {
    dateStyle: 'medium',
    timeStyle: 'short',
    ...(timeZone ? { timeZone } : {})
  }).format(new Date(timestampMs))
}

export function studioDateTimeIso(timestampMs: number | null): string | undefined {
  if (timestampMs === null || !Number.isFinite(timestampMs)) return undefined
  return new Date(timestampMs).toISOString()
}
