// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api, type UltimateBuilderState } from '../lib/api'
import { useProjectLedger } from './useProjectLedger'

describe('project status polling', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })
  it.each(['network', 'job-reader'])('does not overlap requests and marks retained data stale after %s failure', async (failure) => {
    vi.useFakeTimers()
    let resolve!: (state: UltimateBuilderState) => void
    const read = vi.spyOn(api, 'getUltimateBuilderState').mockImplementationOnce(
      () =>
        new Promise(done => {
          resolve = done
        })
    )
    const root = createRoot(document.createElement('div'))
    let state!: ReturnType<typeof useProjectLedger>
    function Harness() {
      state = useProjectLedger(true, '/project')
      return null
    }
    try {
      await act(async () => {
        root.render(<Harness />)
      })
      await act(async () => {
        vi.advanceTimersByTime(15_000)
      })
      expect(read).toHaveBeenCalledTimes(1)
      await act(async () => {
        resolve({
          phase_state: {
            available: true,
            phases: [{ id: 'researcher', label: 'Research', state: 'pending', status: 'Queued' }]
          },
          run_state: null
        } as unknown as UltimateBuilderState)
      })
      expect(state?.stale).toBe(false)
      if (failure === 'network') read.mockRejectedValueOnce(new Error('offline'))
      else read.mockResolvedValueOnce({ run_state: { state: 'unavailable' } } as UltimateBuilderState)
      await act(async () => {
        vi.advanceTimersByTime(5_000)
      })
      expect(state?.stale).toBe(true)
      expect(state?.steps?.[0].label).toBe('Research')
    } finally {
      await act(async () => root.unmount())
    }
  })
})
