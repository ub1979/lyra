import { describe, expect, it } from 'vitest'

import { sessionResumeParams } from './sessionResumeParams.js'

describe('sessionResumeParams', () => {
  it('asks dashboard-hosted resumes to follow the configured model', () => {
    expect(sessionResumeParams('s1', 100, true)).toEqual({
      cols: 100,
      follow_config_model: true,
      session_id: 's1'
    })
  })

  it('leaves standalone resumes on the chat’s own model', () => {
    const params = sessionResumeParams('s1', 80, false)

    expect(params).toEqual({ cols: 80, session_id: 's1' })
    expect('follow_config_model' in params).toBe(false)
  })
})
