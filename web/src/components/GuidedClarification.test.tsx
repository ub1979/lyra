import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { GuidedClarification } from './GuidedClarification'
import { GuidedCoordinatorActivity } from './GuidedCoordinatorActivity'

describe('Studio question presentation', () => {
  it('shows the hidden question, every option and a custom answer field', () => {
    const html = renderToStaticMarkup(
      <GuidedClarification
        request={{
          requestId: 'r',
          question: 'How should employers use Hello?',
          choices: ['Introductions only', 'Screening support', 'Safer default']
        }}
        sending={false}
        onAnswer={() => {}}
      />
    )
    for (const text of [
      'How should employers use Hello?',
      'Introductions only',
      'Screening support',
      'Safer default',
      'write your own answer',
      'Send answer'
    ])
      expect(html).toContain(text)
  })
  it('shows waiting for the user, not a stuck tool or a QA agent', () => {
    const html = renderToStaticMarkup(
      <GuidedCoordinatorActivity
        text="checking project status"
        lastSignalAt={1}
        runningTool={{ label: 'Clarify', startedAt: 1 }}
        onRetry={() => {}}
        waitingForInput
      />
    )
    expect(html).toContain('Lyra is waiting for your answer')
    expect(html).not.toContain('Stop &amp; retry')
    expect(html).not.toContain('Tool running')
    expect(html).not.toContain('Quality assurance')
  })
})
