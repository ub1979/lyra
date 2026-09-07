// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GuidedCoordinatorActivity } from './GuidedCoordinatorActivity'

describe('live chat feedback', () => {
  afterEach(() => vi.useRealTimers())

  it('always offers control while an ordinary turn is running', async () => {
    const host = document.createElement('div')
    const root = createRoot(host)
    try {
      await act(async () => {
        root.render(
          <GuidedCoordinatorActivity
            text="Thinking about your message…"
            lastSignalAt={Date.now()}
            runningTool={null}
            onRetry={() => {}}
          />
        )
      })
      expect(host.textContent).toContain('Stop & retry')
    } finally {
      await act(async () => root.unmount())
    }
  })

  it('keeps summarizing visible between real heartbeats and distinguishes a missing update', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(100_000)
    const host = document.createElement('div')
    const root = createRoot(host)
    const onRetry = vi.fn()
    const render = (lastSignalAt: number, compacting = true) =>
      root.render(
        <GuidedCoordinatorActivity
          text="Answer received. Continuing…"
          compacting={compacting}
          lastSignalAt={lastSignalAt}
          runningTool={null}
          onRetry={onRetry}
        />
      )
    try {
      await act(async () => {
        render(100_000)
      })
      await act(async () => {
        vi.advanceTimersByTime(45_000)
      })
      expect(host.textContent).toContain('Lyra is summarizing your conversation')
      expect(host.textContent).toContain('can take a few minutes')
      expect(host.textContent).toContain('Last update 45s ago')
      expect(host.querySelector('button')).toBeNull()
      await act(async () => {
        vi.advanceTimersByTime(15_000)
        render(Date.now())
      })
      expect(host.textContent).toContain('Last update 0s ago')
      await act(async () => {
        vi.advanceTimersByTime(91_000)
      })
      expect(host.textContent).toContain('No recent update from the summarizing step')
      expect(host.textContent).toContain('Lyra is summarizing your conversation')
      expect(onRetry).not.toHaveBeenCalled()
      await act(async () => {
        host.querySelector('button')!.click()
      })
      expect(onRetry).toHaveBeenCalledTimes(1)
      await act(async () => {
        render(Date.now(), false)
      })
      expect(host.textContent).toContain('Answer received. Continuing')
      expect(host.textContent).not.toContain('summarizing')
    } finally {
      await act(async () => root.unmount())
    }
  })

  it('shows delivery confirmation pending instead of asking the user to answer again', async () => {
    const host = document.createElement('div')
    const root = createRoot(host)
    try {
      await act(async () => {
        root.render(
          <GuidedCoordinatorActivity
            text=""
            waitingForInput
            sendingAnswer
            lastSignalAt={1}
            runningTool={null}
            onRetry={() => {}}
          />
        )
      })
      expect(host.textContent).toContain('Sending your answer')
      expect(host.textContent).toContain('confirm it received your answer')
      expect(host.textContent).not.toContain('Answer the question shown')
      expect(host.querySelector('button')).toBeNull()
    } finally {
      await act(async () => root.unmount())
    }
  })
})
