import { describe, expect, it } from 'vitest'
import { decodePromptAnswerFrame } from '@hermes/shared'
import {
  answerGuidedClarification,
  guidedClarificationAnswer,
  guidedClarificationMessage,
  readGuidedClarification,
  type GuidedClarificationRequest
} from './guided-clarification'
import { decideGuidedWatchdog, GUIDED_TOOL_SILENCE_GRACE_MS } from './guided-turn-watchdog'

const request: GuidedClarificationRequest = {
  answerProtocol: 'atomic-v1',
  requestId: 'question-1',
  question: 'How should Hello work?',
  choices: ['Introductions only', 'Screening support', 'Safer default']
}

function transportHarness() {
  const frames: string[] = []
  const pending: Array<() => void> = []
  let active = true
  return {
    frames,
    close: () => {
      active = false
    },
    flush: () => {
      while (pending.length) pending.shift()!()
    },
    transport: {
      isOpen: () => active,
      send: (data: string) => {
        frames.push(data)
      },
      schedule: (run: () => void) => {
        pending.push(run)
      }
    }
  }
}

describe('guided clarification', () => {
  it('puts the question and choices in one ordinary message for a typed reply', () => {
    const message = guidedClarificationMessage('Which country?', ['UK', 'Canada'])
    expect(message).toContain('Which country?')
    expect(message).toContain('1. UK')
    expect(message).toContain('2. Canada')
    expect(message).toContain('type your own answer')
  })

  it('asks for a typed reply when there are no suggested choices', () => {
    expect(guidedClarificationMessage('What should change?', [])).toContain(
      'Type your answer below.'
    )
  })

  it('turns a typed list number into the corresponding answer', () => {
    expect(guidedClarificationAnswer(request, '2')).toBe('Screening support')
    expect(guidedClarificationAnswer(request, 'My own answer')).toBe('My own answer')
    expect(guidedClarificationAnswer(request, '9')).toBe('9')
  })

  it('never sends a new answer frame to an older running server', () => {
    const h = transportHarness()
    expect(answerGuidedClarification({ ...request, answerProtocol: undefined }, 'UK', h.transport)).toBe(false)
    expect(h.frames).toEqual([])
  })
  it('requires a real request ID and question', () => {
    expect(readGuidedClarification({ request_id: 'r1', question: 'Which country?', choices: ['UK'] })).toEqual({
      requestId: 'r1',
      question: 'Which country?',
      choices: ['UK']
    })
    expect(readGuidedClarification({ question: 'QA checks' })).toBeNull()
    expect(readGuidedClarification(undefined)).toBeNull()
  })

  it.each(request.choices)('sends the exact Ink choice for %s without a new chat prompt', choice => {
    const h = transportHarness()
    expect(answerGuidedClarification(request, choice, h.transport)).toBe(true)
    h.flush()
    expect(h.frames).toHaveLength(1)
    expect(decodePromptAnswerFrame(h.frames[0])).toEqual({ requestId: request.requestId, answer: choice })
  })

  it('sends the complete custom answer in one request-fenced frame', () => {
    const h = transportHarness()
    answerGuidedClarification(request, 'UK first\nOther countries later', h.transport)
    h.flush()
    expect(h.frames).toHaveLength(1)
    expect(decodePromptAnswerFrame(h.frames[0])?.answer).toBe('UK first\nOther countries later')
  })

  it('uses the text input directly for an open question and strips terminal controls', () => {
    const h = transportHarness()
    answerGuidedClarification({ ...request, choices: [] }, 'UK\x03', h.transport)
    h.flush()
    expect(decodePromptAnswerFrame(h.frames[0])?.answer).toBe('UK')
  })

  it('does not send delayed keys after the request expires or the socket changes', () => {
    const h = transportHarness()
    answerGuidedClarification(request, 'My own answer', h.transport)
    h.close()
    const before = [...h.frames]
    h.flush()
    expect(h.frames).toEqual(before)
    expect(answerGuidedClarification(request, 'Safer default', h.transport)).toBe(false)
  })

  it('never turns time waiting for the user into the seven-minute tool failure', () => {
    const now = GUIDED_TOOL_SILENCE_GRACE_MS * 10
    const state = { now, toolGraceUntil: GUIDED_TOOL_SILENCE_GRACE_MS, subagentGraceUntil: 0 }
    expect(decideGuidedWatchdog({ ...state, waitingForInput: true })).toEqual({ action: 'extend' })
    expect(decideGuidedWatchdog(state)).toEqual({ action: 'stop', reason: 'tool' })
  })
})
