// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'
import { ProjectAttention } from './ProjectAttention'
import { job, savedRun } from '../lib/project-agent-activity.fixtures'
import { projectAttentionPrompt } from '../lib/project-attention'
import { projectAgentActivity } from '../lib/project-agent-activity'

const review = job({ phase: 'job:default:raw', task_id: 'raw', label: 'Project foundation',
  status: 'blocked', block_kind: 'needs_input', attention_id: '95',
  wait_reason: 'review-required: TG-001 verified in commit deadbeef; approve before TG-002.' })

describe('durable Studio review handoff', () => {
  it('warns when the first status load fails instead of implying that no work is waiting', async () => {
    const host = document.createElement('div')
    const root = createRoot(host)
    try {
      await act(async () => root.render(<ProjectAttention state={null} stale onReview={() => {}} />))
      expect(host.textContent).toContain('Lyra cannot confirm the current worker status')
      expect(host.querySelector('button')).toBeNull()
    } finally { await act(async () => root.unmount()) }
  })

  it('shows an actionable review without a chat event, sidebar or code-review burden', async () => {
    const host = document.createElement('div')
    const root = createRoot(host)
    const onReview = vi.fn()
    try {
      await act(async () => root.render(<ProjectAttention state={savedRun([review])} stale={false} onReview={onReview} />))
      expect(host.textContent).toContain('You do not need to read code')
      expect(host.textContent).not.toContain('TG-001')
      expect(host.textContent).not.toContain('deadbeef')
      expect(onReview).not.toHaveBeenCalled()
      await act(async () => host.querySelector('button')!.click())
      expect(onReview).toHaveBeenCalledExactlyOnceWith(review)
      const prompt = projectAttentionPrompt(onReview.mock.calls[0][0])
      expect(prompt).toContain('not approval of unverified work or new scope')
      expect(JSON.parse(prompt.slice(prompt.indexOf('{')))).toEqual({ board: 'default', task_id: 'raw', attention_id: '95' })
      expect(projectAgentActivity(savedRun([review]))[0].status).toBe('Waiting for Lyra to review')
    } finally { await act(async () => root.unmount()) }
  })

  it.each([
    { stale: true, disabledReason: undefined, notice: 'Reconnecting to project status' },
    { stale: false, disabledReason: 'Answer the open question first.', notice: 'Answer the open question first.' },
    { stale: false, disabledReason: 'Reconnect the project chat.', notice: 'Reconnect the project chat.' }
  ])('does not submit a stale or unavailable action: $notice', async ({ stale, disabledReason, notice }) => {
    const host = document.createElement('div')
    const root = createRoot(host)
    const onReview = vi.fn()
    try {
      await act(async () => root.render(<ProjectAttention state={savedRun([review])} stale={stale} disabledReason={disabledReason} onReview={onReview} />))
      const button = host.querySelector('button')!
      expect(button.disabled).toBe(true)
      await act(async () => button.click())
      expect(onReview).not.toHaveBeenCalled()
      expect(host.textContent).toContain(notice)
    } finally { await act(async () => root.unmount()) }
  })

  it('clears the card when work resumes and respects intentional user pauses', async () => {
    const host = document.createElement('div')
    const root = createRoot(host)
    try {
      await act(async () => root.render(<ProjectAttention state={savedRun([review])} stale={false} onReview={() => {}} />))
      expect(host.querySelector('section')).not.toBeNull()
      for (const task of [{ ...review, status: 'running' }, { ...review, paused_by_user: true }]) {
        await act(async () => root.render(<ProjectAttention state={savedRun([task])} stale={false} onReview={() => {}} />))
        expect(host.querySelector('section')).toBeNull()
      }
    } finally { await act(async () => root.unmount()) }
  })

  it('keeps real user questions distinct and escapes worker text', async () => {
    const host = document.createElement('div')
    const root = createRoot(host)
    const task = { ...review, wait_reason: 'Which launch country? <script>bad()</script>' }
    try {
      await act(async () => root.render(<ProjectAttention state={savedRun([task])} stale={false} onReview={() => {}} />))
      expect(host.textContent).toContain('Which launch country?')
      expect(host.textContent).toContain('Ask Lyra what is needed')
      expect(host.querySelector('script')).toBeNull()
      expect(projectAttentionPrompt(task)).toContain('Do not treat this request as my answer or approval')
    } finally { await act(async () => root.unmount()) }
  })
})
