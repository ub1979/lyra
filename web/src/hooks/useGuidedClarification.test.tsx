// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useGuidedClarification } from './useGuidedClarification'
import { GuidedClarification } from '../components/GuidedClarification'

describe('clarification event-to-answer integration', () => {
  afterEach(() => vi.useRealTimers())

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
          request_id: 'r1',
          question: 'Launch country?',
          choices: ['UK', 'Elsewhere']
        })
      })
      expect(host.textContent).toContain('Launch country?')
      await act(async () => {
        host.querySelector<HTMLButtonElement>('button')!.click()
        control.answer('UK')
      })
      expect(send.mock.calls).toEqual([['1']])
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
        control.handleEvent('clarify.request', { request_id: 'r1', question: 'Country?', choices: ['UK'] })
      })
      await act(async () => {
        control.handleEvent('clarify.expire', { request_id: 'old' })
      })
      expect(control.request?.requestId).toBe('r1')
      await act(async () => {
        control.answer('Canada')
      })
      const sent = send.mock.calls.length
      await act(async () => {
        control.handleEvent('clarify.expire', { request_id: 'r1' })
        vi.runAllTimers()
      })
      expect(send).toHaveBeenCalledTimes(sent)
      expect(control.request).toBeNull()
      await act(async () => {
        control.handleEvent('clarify.request', { request_id: 'r2', question: 'Country?' })
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
