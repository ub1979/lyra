import { describe, expect, it } from 'vitest'
import {
  answerGuidedClarification,
  readGuidedClarification,
  type GuidedClarificationRequest
} from './guided-clarification'
import { decideGuidedWatchdog, GUIDED_TOOL_SILENCE_GRACE_MS } from './guided-turn-watchdog'

const request: GuidedClarificationRequest = {
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
    expect(h.frames).toEqual([String(request.choices.indexOf(choice) + 1)])
  })

  it('opens Other before sending the complete custom answer', () => {
    const h = transportHarness()
    answerGuidedClarification(request, 'UK first\nOther countries later', h.transport)
    h.flush()
    expect(h.frames.slice(0, 7)).toEqual(['\x1b[A', '\x1b[A', '\x1b[A', '\x1b[B', '\x1b[B', '\x1b[B', '\r'])
    expect(h.frames.slice(7)).toEqual(['\x1b[200~UK first\nOther countries later\x1b[201~', '\r'])
  })

  it('uses the text input directly for an open question and strips terminal controls', () => {
    const h = transportHarness()
    answerGuidedClarification({ ...request, choices: [] }, 'UK\x03', h.transport)
    h.flush()
    expect(h.frames).toEqual(['UK', '\r'])
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
