import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { GuidedClarification } from './GuidedClarification'
import { GuidedCoordinatorActivity } from './GuidedCoordinatorActivity'

describe('Studio question presentation', () => {
  it('attaches every option without repeating Lyra’s question', () => {
    const question = 'How should employers use Hello?'
    const html = renderToStaticMarkup(
      <article>
        <p>{question}</p>
        <GuidedClarification
          request={{
            requestId: 'r',
            question,
            choices: ['Introductions only', 'Screening support', 'Safer default']
          }}
          sending={false}
          onAnswer={() => {}}
        />
      </article>
    )
    for (const text of [
      'Introductions only',
      'Screening support',
      'Safer default',
      'write your own answer',
      'Send answer'
    ])
      expect(html).toContain(text)
    expect(html.split(question)).toHaveLength(2)
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
