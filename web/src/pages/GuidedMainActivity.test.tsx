import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { GuidedMainActivity } from './ChatPage'

describe('GuidedMainActivity', () => {
  it('shows live coordinator progress in the main conversation', () => {
    const html = renderToStaticMarkup(
      <GuidedMainActivity
        activity={{
          phase: 'working',
          text: 'Recording your approval…',
          specialist: null
        }}
      />
    )

    expect(html).toContain('Lyra is working')
    expect(html).toContain('Recording your approval…')
    expect(html).toContain('role="status"')
    expect(html).not.toContain('Stop &amp; retry')
    expect(html).not.toContain('Review with Lyra')
  })

  it('does not leave a progress bubble after the turn settles', () => {
    const html = renderToStaticMarkup(<GuidedMainActivity activity={{ phase: 'idle', text: '', specialist: null }} />)

    expect(html).toBe('')
  })
})
