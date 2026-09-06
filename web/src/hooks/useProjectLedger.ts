/** Polls the durable project ledger independently of chat transport. */
import { useEffect, useState } from 'react'
import { api, type UltimateBuilderRunState } from '../lib/api'
import type { GuidedPhaseStep } from '../lib/guided-phase-plan'

export function useProjectLedger(guided: boolean, workspaceParam: string) {
  const [guidedLedger, setGuidedLedger] = useState<{
    workspace: string
    steps: GuidedPhaseStep[] | null
    runState: UltimateBuilderRunState | null
    stale: boolean
  } | null>(null)
  useEffect(() => {
    if (!guided || !workspaceParam) return
    let cancelled = false
    let refreshing = false

    const refreshLedger = async () => {
      if (refreshing) return
      refreshing = true
      try {
        const state = await api.getUltimateBuilderState(workspaceParam)
        if (cancelled) return
        // The API can preserve phase history while its job reader fails.
        // A successful HTTP response is not proof that the job state is live.
        if (state.run_state?.state === 'unavailable') throw new Error('Project jobs unavailable')
        setGuidedLedger({
          workspace: workspaceParam,
          steps: state.phase_state.available
            ? state.phase_state.phases.map(phase => ({
                id: phase.id,
                label: phase.label,
                state: phase.state,
                status: phase.status
              }))
            : null,
          runState: state.run_state ?? null,
          stale: false
        })
      } catch {
        if (cancelled) return
        // Preserve useful history, but never present an old snapshot as live.
        setGuidedLedger(current => ({
          workspace: workspaceParam,
          steps: current?.workspace === workspaceParam ? current.steps : null,
          runState: current?.workspace === workspaceParam ? current.runState : null,
          stale: true
        }))
      } finally {
        refreshing = false
      }
    }

    void refreshLedger()
    const timer = window.setInterval(() => void refreshLedger(), 5_000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [guided, workspaceParam])
  return guidedLedger
}
