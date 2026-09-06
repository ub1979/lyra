import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { GuidedApprovalActions } from './GuidedApprovalActions'

describe('Studio approval presentation', () => {
  it('keeps choices with Lyra’s message and command detail collapsed', () => {
    const html = renderToStaticMarkup(
      <article>
        <p>May I run the project tests?</p>
        <GuidedApprovalActions
          choices={['once', 'deny']}
          command="npm test"
          labels={{ once: 'Allow once', deny: 'Deny', session: 'Allow this session', always: 'Always allow' }}
          onChoose={() => {}}
        />
      </article>
    )
    expect(html).toContain('May I run the project tests?')
    expect(html).toContain('Allow once')
    expect(html).toContain('Deny')
    expect(html).toContain('<details')
    expect(html).toContain('View action details')
    expect(html).toContain('npm test')
  })
})
