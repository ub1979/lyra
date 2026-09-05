// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { StudioQuestionAlerts } from './StudioQuestionAlerts'

describe('Studio alert control', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  it('asks permission only after a click and does not repeat an alert on rerender', async () => {
    localStorage.clear()
    const delivered: string[] = []
    const permission = vi.fn(async () => 'granted')
    class FakeNotification {
      static permission = 'granted'
      static requestPermission = permission
      constructor(title: string) {
        delivered.push(title)
      }
    }
    vi.stubGlobal('Notification', FakeNotification)
    const host = document.createElement('div')
    const root = createRoot(host)
    const props = {
      workspace: 'project-a',
      question: { requestId: 'q1', question: 'Private question', choices: [] },
      runState: null,
      stale: false
    }
    try {
      await act(async () => {
        root.render(<StudioQuestionAlerts {...props} />)
      })
      expect(permission).not.toHaveBeenCalled()
      expect(delivered).toEqual([])
      await act(async () => {
        host.querySelector('button')!.click()
      })
      expect(permission).toHaveBeenCalledTimes(1)
      expect(delivered).toEqual(['Lyra needs your answer'])
      await act(async () => {
        root.render(<StudioQuestionAlerts {...props} question={{ ...props.question }} />)
      })
      expect(delivered).toHaveLength(1)
      await act(async () => {
        host.querySelector('button')!.click()
      })
      expect(host.querySelector('button')!.getAttribute('aria-pressed')).toBe('false')
    } finally {
      await act(async () => root.unmount())
    }
  })
})
