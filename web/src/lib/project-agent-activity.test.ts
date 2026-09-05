import { describe, expect, it } from 'vitest'
import { job, savedRun } from './project-agent-activity.fixtures'
import { coordinatorActivityMessage, projectAgentActivity, projectAgentSummary } from './project-agent-activity'

describe('saved project agent activity', () => {
  it('restores Research without any chat worker events and retains it after completion', () => {
    const running = projectAgentActivity(savedRun([job()]))
    expect(running[0]).toMatchObject({ label: 'Research', running: true, status: 'Working' })
    const reloaded = projectAgentActivity(JSON.parse(JSON.stringify(savedRun([job({ status: 'done' })]))))
    expect(reloaded[0]).toMatchObject({ label: 'Research', running: false, status: 'Completed' })
  })

  it.each(['todo', 'ready', 'scheduled', 'blocked', 'triage', 'done', 'archived', 'future-state'])(
    'never treats %s as working even if the aggregate says working',
    status => {
      const items = projectAgentActivity(savedRun([job({ status })]))
      expect(items[0].running).toBe(false)
      expect(projectAgentSummary(items)).not.toContain('working')
      expect(coordinatorActivityMessage(items)).not.toContain('while the project agents work')
    }
  )

  it('distinguishes a decision from a manual pause and a failure', () => {
    const decision = projectAgentActivity(
      savedRun([job({ status: 'blocked', block_kind: 'needs_input', wait_reason: 'Which country?' })])
    )
    expect(decision[0]).toMatchObject({ status: 'Waiting for your input', detail: 'Which country?', attention: true })
    const paused = projectAgentActivity(
      savedRun([job({ status: 'blocked', block_kind: 'needs_input', paused_by_user: true })])
    )
    expect(paused[0]).toMatchObject({ status: 'Paused by you', attention: false })
    const failure = projectAgentActivity(savedRun([job({ status: 'blocked', last_error: 'Provider unavailable' })]))
    expect(failure[0]).toMatchObject({ status: 'Needs attention', detail: 'Provider unavailable' })
  })

  it('reports mixed working and waiting jobs, without counting completed or queued jobs', () => {
    const items = projectAgentActivity(
      savedRun([
        job(),
        job({ task_id: 'a', phase: 'sw-architect', status: 'blocked' }),
        job({ task_id: 'b', status: 'done' }),
        job({ task_id: 'c', status: 'ready' })
      ])
    )
    expect(projectAgentSummary(items, 1)).toBe('2 working · 1 need attention')
  })

  it('retains stale history without claiming it is live, then recovers', () => {
    const state = savedRun([job()])
    expect(projectAgentActivity(state, true)[0]).toMatchObject({ status: 'Last known: Working', running: false })
    expect(projectAgentActivity(state, false)[0].running).toBe(true)
    expect(projectAgentActivity(null)).toEqual([])
  })

  it('does not mix jobs on different boards or mutate the server snapshot', () => {
    const state = savedRun([job(), job({ board: 'other' })])
    const original = structuredClone(state)
    expect(new Set(projectAgentActivity(state).map(item => item.id)).size).toBe(2)
    expect(state).toEqual(original)
  })
})
