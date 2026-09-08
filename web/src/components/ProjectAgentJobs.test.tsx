import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ProjectAgentJobs } from './ProjectAgentJobs'
import {
  activeProjectAgentActivity,
  projectAgentActivity
} from '../lib/project-agent-activity'
import { job, savedRun } from '../lib/project-agent-activity.fixtures'

describe('Studio agent activity rendering', () => {
  it('shows only work happening now, not queued, completed or waiting jobs', () => {
    const items = activeProjectAgentActivity(
      projectAgentActivity(
        savedRun([
          job({ task_id: 'active', label: 'Development', status: 'running' }),
          job({ task_id: 'done', label: 'Research', status: 'done' }),
          job({ task_id: 'queued', label: 'Architecture', status: 'ready' }),
          job({ task_id: 'waiting', label: 'Quality assurance', status: 'blocked' })
        ])
      )
    )
    const html = renderToStaticMarkup(<ProjectAgentJobs items={items} stale={false} />)
    expect(html).toContain('Development: Working')
    expect(html).not.toContain('Research')
    expect(html).not.toContain('Architecture')
    expect(html).not.toContain('Quality assurance')
    expect(html).toContain('Last update')
  })
  it('keeps historical jobs out of the active projection', () => {
    const items = activeProjectAgentActivity(
      projectAgentActivity(
        savedRun([
          job({ status: 'done' }),
          job({
            task_id: 'architecture-1',
            phase: 'sw-architect',
            label: 'Architecture',
            status: 'blocked',
            block_kind: 'needs_input',
            wait_reason: 'Which launch country?'
          })
        ])
      )
    )
    const html = renderToStaticMarkup(<ProjectAgentJobs items={items} stale={false} />)
    expect(html).not.toContain('Research')
    expect(html).not.toContain('Architecture')
    expect(html).not.toContain('Which launch country?')
    expect(html).not.toContain('<button')
  })

  it('keeps stopped work out of Agent Activity', () => {
    const items = activeProjectAgentActivity(projectAgentActivity(savedRun([
      job({
        phase: 'sw-developer',
        label: 'Development · TG-005: Platform ledger',
        status: 'blocked',
        last_error: 'Iteration budget exhausted (90/90)'
      })
    ])))
    const html = renderToStaticMarkup(<ProjectAgentJobs items={items} stale={false} />)
    expect(html).not.toContain('Development · TG-005: Platform ledger')
    expect(html).not.toContain('90/90')
  })

  it('escapes saved reasons as text and announces stale status', () => {
    const items = projectAgentActivity(
      savedRun([job({ status: 'blocked', wait_reason: '<script>unsafe()</script>' })]),
      true
    )
    const html = renderToStaticMarkup(<ProjectAgentJobs items={items} stale />)
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
    expect(html).toContain('temporarily unavailable')
  })
})
