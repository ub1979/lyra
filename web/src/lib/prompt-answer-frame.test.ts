import { describe, expect, it } from 'vitest'
import { decodePromptAnswerFrame, encodePromptAnswerFrame, isPromptAnswerFrame } from '@hermes/shared'

describe('atomic answer protocol', () => {
  it('round-trips Unicode, quotes and multiline answers without an Enter key', () => {
    const reply = { requestId: 'q1', answer: 'اردو\n"UK" first' }
    const frame = encodePromptAnswerFrame(reply)
    expect(decodePromptAnswerFrame(frame)).toEqual(reply)
    expect(frame).not.toContain('\r')
    expect(frame).not.toContain('\n')
  })
  it('rejects malformed or oversized frames and does not mistake ordinary typing for an answer', () => {
    expect(decodePromptAnswerFrame('LYRA_PROMPT_ANSWER_V1:bad')).toBeNull()
    expect(decodePromptAnswerFrame('LYRA_PROMPT_ANSWER_V1:null')).toBeNull()
    expect(isPromptAnswerFrame('UK only')).toBe(false)
    expect(() => encodePromptAnswerFrame({ requestId: '1', answer: 'a'.repeat(32_001) })).toThrow()
  })
})
