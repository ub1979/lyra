import type { UltimateBuilderRunUsage } from './api'
import { formatGuidedTokens } from './guided-agent-runtime'

export interface ProjectAgentUsage {
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
  reasoning: number
  calls: number
  costUsd: number | null
  costStatus: string
  model: string
  attempts: number
  recordedAt: number | null
}

export interface ProjectAgentUsageTotal {
  reported: number
  total: number
  tokens: number
  costUsd: number
  costKnown: boolean
}

const count = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0

/** A missing usage record stays null; only a saved record may show as zero. */
export function normalizeProjectAgentUsage(
  wire: UltimateBuilderRunUsage | null | undefined
): ProjectAgentUsage | null {
  if (!wire || typeof wire !== 'object') return null
  return {
    input: count(wire.input_tokens),
    output: count(wire.output_tokens),
    cacheRead: count(wire.cache_read_tokens),
    cacheWrite: count(wire.cache_write_tokens),
    reasoning: count(wire.reasoning_tokens),
    calls: count(wire.api_calls),
    costUsd: typeof wire.cost_usd === 'number' && Number.isFinite(wire.cost_usd) ? wire.cost_usd : null,
    costStatus: typeof wire.cost_status === 'string' ? wire.cost_status : '',
    model: typeof wire.model === 'string' ? wire.model : '',
    attempts: Math.max(1, count(wire.attempts)),
    recordedAt: typeof wire.recorded_at === 'number' ? wire.recorded_at : null
  }
}

/** Same canonical total as the coordinator panel: prompt (fresh + cached + cache write) + output. */
export function projectAgentUsageTokens(usage: ProjectAgentUsage): number {
  return usage.input + usage.cacheRead + usage.cacheWrite + usage.output
}

/** Sum every saved record, finished jobs included, so the total never shrinks as work completes. */
export function projectAgentUsageTotal(
  items: readonly { usage: ProjectAgentUsage | null }[]
): ProjectAgentUsageTotal {
  const reported = items.filter(item => item.usage !== null) as { usage: ProjectAgentUsage }[]
  const priced = reported.filter(item => item.usage.costUsd !== null)
  return {
    reported: reported.length,
    total: items.length,
    tokens: reported.reduce((sum, item) => sum + projectAgentUsageTokens(item.usage), 0),
    costUsd: priced.reduce((sum, item) => sum + (item.usage.costUsd ?? 0), 0),
    costKnown: reported.length > 0 && priced.length === reported.length
  }
}

export function formatProjectAgentUsage(usage: ProjectAgentUsage | null): string {
  if (!usage) return 'Usage not reported'
  const tokens = `${formatGuidedTokens(projectAgentUsageTokens(usage))} tokens`
  const calls = `${usage.calls} ${usage.calls === 1 ? 'call' : 'calls'}`
  const cost = usage.costUsd !== null ? ` · ~$${usage.costUsd.toFixed(3)}` : ''
  const attempts = usage.attempts > 1 ? ` · ${usage.attempts} attempts` : ''
  return `${tokens} · ${calls}${cost}${attempts}`
}
