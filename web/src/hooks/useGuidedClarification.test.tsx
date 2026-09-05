// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useGuidedClarification } from './useGuidedClarification'
import { GuidedClarification } from '../components/GuidedClarification'
import { decodePromptAnswerFrame } from '@hermes/shared'

describe('clarification event-to-answer integration', () => {
  afterEach(() => vi.useRealTimers())

  it('allows a safe request-fenced retry after a disconnect with no delivery confirmation', async () => {
    vi.useFakeTimers()
    const host = document.createElement('div')
    const root = createRoot(host)
    const firstSend = vi.fn()
    const secondSend = vi.fn()
    const socketRef = { current: { readyState: WebSocket.OPEN, send: firstSend } as unknown as WebSocket }
    let control!: ReturnType<typeof useGuidedClarification>
    function Harness() { control = useGuidedClarification(socketRef); return null }
    try {
      await act(async () => { root.render(<Harness />) })
      await act(async () => { control.handleEvent('clarify.request', { answer_protocol: 'atomic-v1', request_id: 'q1', question: 'Country?', choices: ['UK'] }) })
      await act(async () => { control.answer('Canada') })
      expect(control.sending).toBe(true)
      socketRef.current = { readyState: WebSocket.OPEN, send: secondSend } as unknown as WebSocket
      await act(async () => {
        control.handleEvent('clarify.request', { answer_protocol: 'atomic-v1', request_id: 'q1', question: 'Country?', choices: ['UK'] })
        vi.advanceTimersByTime(12_000)
      })
      expect(control.sending).toBe(false)
      expect(control.error).toContain('not been confirmed')
      await act(async () => { expect(control.answer('Canada')).toBe(true) })
      expect(firstSend).toHaveBeenCalledTimes(1)
      expect(secondSend).toHaveBeenCalledTimes(1)
      expect(secondSend.mock.calls[0][0]).toBe(firstSend.mock.calls[0][0])
      await act(async () => { control.handleEvent('tool.complete', { name: 'clarify' }) })
      expect(control.request).toBeNull()
      expect(control.error).toBe('')
    } finally { await act(async () => root.unmount()) }
  })

  it('renders an incoming request, sends only one answer, ignores unrelated tools and clears on completion', async () => {
    const host = document.createElement('div')
    const root = createRoot(host)
    const send = vi.fn()
    const socketRef = { current: { readyState: WebSocket.OPEN, send } as unknown as WebSocket }
    let control!: ReturnType<typeof useGuidedClarification>
    function Harness() {
      control = useGuidedClarification(socketRef)
      return control.request ? (
        <GuidedClarification request={control.request} sending={control.sending} onAnswer={control.answer} />
      ) : null
    }
    await act(async () => {
      root.render(<Harness />)
    })
    try {
      await act(async () => {
        control.handleEvent('clarify.request', {
          answer_protocol: 'atomic-v1', request_id: 'r1',
          question: 'Launch country?',
          choices: ['UK', 'Elsewhere']
        })
      })
      expect(host.textContent).toContain('Launch country?')
      await act(async () => {
        host.querySelector<HTMLButtonElement>('button')!.click()
        control.answer('UK')
      })
      expect(send).toHaveBeenCalledTimes(1)
      expect(decodePromptAnswerFrame(send.mock.calls[0][0])).toEqual({ requestId: 'r1', answer: 'UK' })
      expect(control.sending).toBe(true)
      await act(async () => {
        control.handleEvent('tool.complete', { name: 'terminal' })
      })
      expect(control.request?.requestId).toBe('r1')
      await act(async () => {
        control.handleEvent('tool.complete', { name: 'clarify' })
      })
      expect(host.textContent).toBe('')
    } finally {
      await act(async () => root.unmount())
    }
  })

  it('fences delayed custom-answer writes when a request expires or the project changes', async () => {
    vi.useFakeTimers()
    const host = document.createElement('div')
    const root = createRoot(host)
    const send = vi.fn()
    const socketRef = { current: { readyState: WebSocket.OPEN, send } as unknown as WebSocket }
    let control!: ReturnType<typeof useGuidedClarification>
    function Harness() {
      control = useGuidedClarification(socketRef)
      return null
    }
    await act(async () => {
      root.render(<Harness />)
    })
    try {
      await act(async () => {
        control.handleEvent('clarify.request', { answer_protocol: 'atomic-v1', request_id: 'r1', question: 'Country?', choices: ['UK'] })
      })
      await act(async () => {
        control.handleEvent('clarify.expire', { answer_protocol: 'atomic-v1', request_id: 'old' })
      })
      expect(control.request?.requestId).toBe('r1')
      await act(async () => {
        control.answer('Canada')
      })
      const sent = send.mock.calls.length
      await act(async () => {
        control.handleEvent('clarify.expire', { answer_protocol: 'atomic-v1', request_id: 'r1' })
        vi.runAllTimers()
      })
      expect(send).toHaveBeenCalledTimes(sent)
      expect(control.request).toBeNull()
      await act(async () => {
        control.handleEvent('clarify.request', { answer_protocol: 'atomic-v1', request_id: 'r2', question: 'Country?' })
      })
      await act(async () => {
        control.clear()
      })
      expect(control.answer('UK')).toBe(false)
    } finally {
      await act(async () => root.unmount())
    }
  })
})
