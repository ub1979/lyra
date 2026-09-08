import { describe, expect, it } from 'vitest'
import { job, savedRun } from './project-agent-activity.fixtures'
import {
  activeProjectAgentActivity,
  projectAgentActivity,
  projectAgentSummary
} from './project-agent-activity'

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

  it('explains an exhausted work item as a saved smaller continuation', () => {
    const items = projectAgentActivity(savedRun([job({
      phase: 'sw-developer',
      label: 'Development · TG-005: Platform ledger',
      status: 'blocked',
      last_error: 'Iteration budget exhausted (90/90) — task could not complete'
    })]))
    expect(items[0]).toMatchObject({
      label: 'Development · TG-005: Platform ledger',
      status: 'Saved safely — needs a smaller continuation',
      attention: true
    })
    expect(items[0].detail).toContain('progress is saved')
    expect(items[0].detail).not.toContain('90/90')
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
    expect(projectAgentSummary(items, 1)).toBe('2 working · 1 need attention · 1 queued')
    expect(activeProjectAgentActivity(items).map(item => item.id)).toEqual(['default:research-1'])
  })

  it('retains stale history without claiming it is live, then recovers', () => {
    const state = savedRun([job()])
    expect(projectAgentActivity(state, true)[0]).toMatchObject({ status: 'Last known: Working', running: false })
    expect(projectAgentActivity(state, false)[0].running).toBe(true)
    expect(projectAgentActivity(null)).toEqual([])
  })

  it('keeps quiet work visible and clearly flags a stopped activity signal', () => {
    const quiet = projectAgentActivity(savedRun([job({ activity_health: 'quiet' })]))
    expect(quiet[0]).toMatchObject({
      status: 'Working — waiting for a fresh update',
      running: true,
      attention: false
    })
    expect(quiet[0].detail).toContain('exact last update')

    const stalled = projectAgentActivity(savedRun([job({ activity_health: 'stalled' })]))
    expect(stalled[0]).toMatchObject({
      status: 'No fresh activity — recovery available',
      running: true,
      attention: true
    })
    expect(stalled[0].detail).toContain('Lyra remains available')
  })

  it('explains generic jobs that cannot start and distinguishes queued from running', () => {
    const task = job({
      phase: 'job:default:custom',
      label: 'Build task graph',
      status: 'ready',
      dispatch_issue: 'Ask Lyra to correct the worker assignment.'
    })
    const items = projectAgentActivity(savedRun([task]))
    expect(items[0]).toMatchObject({
      label: 'Build task graph',
      status: 'Cannot start automatically',
      detail: task.dispatch_issue,
      attention: true,
      running: false
    })
    expect(projectAgentSummary(items)).toBe('1 need attention')
    const queued = projectAgentActivity(savedRun([{ ...task, dispatch_issue: '' }]))
    expect(queued[0]).toMatchObject({ status: 'Queued to start', attention: false, running: false })
    expect(projectAgentSummary(queued)).toBe('1 queued')
    const stale = projectAgentActivity(savedRun([task]), true)
    expect(stale[0]).toMatchObject({ status: 'Last known: Cannot start automatically', attention: false })
  })

  it('does not mix jobs on different boards or mutate the server snapshot', () => {
    const state = savedRun([job(), job({ board: 'other' })])
    const original = structuredClone(state)
    expect(new Set(projectAgentActivity(state).map(item => item.id)).size).toBe(2)
    expect(state).toEqual(original)
  })
})
