import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ProjectAgentJobs } from './ProjectAgentJobs'
import { GuidedCoordinatorActivity } from './GuidedCoordinatorActivity'
import { analyzeGuidedChatOutput } from '../lib/guided-chat-output'
import { projectAgentActivity } from '../lib/project-agent-activity'
import { job, savedRun } from '../lib/project-agent-activity.fixtures'

describe('Studio agent activity rendering', () => {
  it('shows generic project jobs with their actual start problem', () => {
    const items = projectAgentActivity(savedRun([job({ phase: 'job:default:custom', label: 'Build task graph',
      status: 'ready', dispatch_issue: 'This job has no available worker.' })]))
    const html = renderToStaticMarkup(<ProjectAgentJobs items={items} stale={false} />)
    expect(html).toContain('Build task graph: Cannot start automatically')
    expect(html).toContain('This job has no available worker.')
  })
  it('keeps the coordinator as Lyra even when the legacy parser guesses QA', () => {
    const activity = analyzeGuidedChatOutput('checking project status')
    const html = renderToStaticMarkup(
      <GuidedCoordinatorActivity text={activity.text} lastSignalAt={Date.now()} runningTool={null} onRetry={() => {}} />
    )
    expect(html).toContain('Lyra is handling your message')
    expect(html).not.toContain('Quality assurance')
    expect(html).not.toContain('qa-engineer')
  })

  it('renders completed Research beside Architecture waiting for a decision', () => {
    const items = projectAgentActivity(
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
    const html = renderToStaticMarkup(<ProjectAgentJobs items={items} stale={false} />)
    expect(html).toContain('Research: Completed')
    expect(html).toContain('Architecture: Waiting for your input')
    expect(html).toContain('Which launch country?')
    expect(html).not.toContain('No workers')
    // Saved job IDs must never become buttons targeting process-local workers.
    expect(html).not.toContain('<button')
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
