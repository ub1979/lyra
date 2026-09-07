import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { GuidedProgressMap } from './GuidedProgressMap'

describe('project map report presentation', () => {
  it('keeps an evidence-review report open and displays the complete explanation', () => {
    const html = renderToStaticMarkup(
      <GuidedProgressMap
        durable
        backgroundJobs
        labels={{ researcher: 'Research' }}
        updatedAt={Date.UTC(2026, 8, 7, 10, 5) / 1000}
        steps={[
          { id: 'researcher', label: 'Research', state: 'pending', status: 'Reported complete — evidence needs review' }
        ]}
      />
    )
    expect(html).toContain('Reported complete — evidence needs review')
    expect(html).toContain('Completed reports still need review')
    expect(html).not.toContain('Verified')
    expect(html).not.toContain('%')
    expect(html).toContain('Last update')
    expect(html).toContain('2026')
  })
})
