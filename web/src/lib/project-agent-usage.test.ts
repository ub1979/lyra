import { describe, expect, it } from 'vitest'
import {
  formatProjectAgentUsage,
  normalizeProjectAgentUsage,
  projectAgentUsageTokens,
  projectAgentUsageTotal
} from './project-agent-usage'
import { projectReportedUsage } from './project-agent-usage'
import { normalizeGuidedUsage } from './guided-agent-runtime'
import { savedRun, job } from './project-agent-activity.fixtures'

const saved = {
  input_tokens: 1200,
  output_tokens: 300,
  cache_read_tokens: 9000,
  cache_write_tokens: 0,
  reasoning_tokens: 40,
  api_calls: 3,
  cost_usd: 0.0125,
  cost_status: 'estimated',
  model: 'claude-opus-4-6',
  recorded_at: 1_700_000_000
}

describe('project agent usage', () => {
  it('combines coordinator and unique historical jobs without dropping completed work', () => {
    const state = savedRun([job({ task_id: 'current', usage: saved })])
    state.worker_usage = [
      { board: 'default', task_id: 'old', usage: saved },
      { board: 'default', task_id: 'current', usage: saved },
      { board: 'default', task_id: 'current', usage: saved },
    ]
    const coordinator = normalizeGuidedUsage({ input: 100, cache_read: 200, cache_write: 80, output: 50, reasoning: 20 })
    const total = projectReportedUsage(state, coordinator)
    expect(total.tokens).toBe(430 + 2 * 10500)
    expect(total.workers.total).toBe(2)
    expect(total.complete).toBe(true)
    state.worker_usage.push({ board: 'default', task_id: 'unknown', usage: null })
    expect(projectReportedUsage(state, coordinator)).toMatchObject({ tokens: total.tokens, complete: false })
  })
  it('keeps a missing record as null instead of zero', () => {
    expect(normalizeProjectAgentUsage(null)).toBeNull()
    expect(normalizeProjectAgentUsage(undefined)).toBeNull()
    expect(normalizeProjectAgentUsage(saved)).toMatchObject({
      input: 1200,
      cacheRead: 9000,
      calls: 3,
      costUsd: 0.0125,
      costStatus: 'estimated'
    })
  })

  it('preserves an unpriced record without inventing a cost', () => {
    const usage = normalizeProjectAgentUsage({ ...saved, cost_usd: null })
    expect(usage?.costUsd).toBeNull()
    expect(formatProjectAgentUsage(usage)).toBe('10.5K tokens · 3 calls')
  })

  it('formats saved usage, retries and the unreported case plainly', () => {
    expect(formatProjectAgentUsage(normalizeProjectAgentUsage(saved))).toBe(
      '10.5K tokens · 3 calls · ~$0.013'
    )
    expect(formatProjectAgentUsage(normalizeProjectAgentUsage({ ...saved, attempts: 2 }))).toBe(
      '10.5K tokens · 3 calls · ~$0.013 · 2 attempts'
    )
    expect(formatProjectAgentUsage(null)).toBe('Usage not reported')
  })

  it('counts tokens with the canonical formula: prompt (fresh + cached + cache write) + output', () => {
    const usage = normalizeProjectAgentUsage({
      ...saved,
      input_tokens: 100,
      cache_read_tokens: 200,
      cache_write_tokens: 80,
      output_tokens: 50,
      reasoning_tokens: 20
    })!
    expect(projectAgentUsageTokens(usage)).toBe(
      usage.input + usage.cacheRead + usage.cacheWrite + usage.output
    )
    expect(projectAgentUsageTokens(usage)).toBe(430)
  })

  it('totals every reported job, finished ones included, and counts the unreported', () => {
    const first = normalizeProjectAgentUsage(saved)!
    const second = normalizeProjectAgentUsage({ ...saved, input_tokens: 800, cost_usd: 0.002 })!
    const items = [{ usage: first }, { usage: second }, { usage: null }]
    expect(projectAgentUsageTotal(items)).toEqual({
      reported: 2,
      total: 3,
      tokens: projectAgentUsageTokens(first) + projectAgentUsageTokens(second),
      costUsd: 0.0145,
      costKnown: true
    })
  })

  it('marks cost unknown when any reported job lacks a price', () => {
    const items = [
      { usage: normalizeProjectAgentUsage(saved) },
      { usage: normalizeProjectAgentUsage({ ...saved, cost_usd: null }) }
    ]
    const total = projectAgentUsageTotal(items)
    expect(total.costKnown).toBe(false)
    expect(total.costUsd).toBe(0.0125)
    expect(projectAgentUsageTotal([]).costKnown).toBe(false)
  })
})
