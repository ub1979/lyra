import { sanitizeGuidedComposerText, writeGuidedPrompt, type GuidedComposerTransport } from './guided-composer-paste'

export interface GuidedClarificationRequest {
  requestId: string
  question: string
  choices: string[]
}

export function readGuidedClarification(
  payload: { request_id?: unknown; question?: unknown; choices?: unknown } | undefined
): GuidedClarificationRequest | null {
  if (
    typeof payload?.request_id !== 'string' ||
    !payload.request_id ||
    typeof payload.question !== 'string' ||
    !payload.question.trim()
  )
    return null
  return {
    requestId: payload.request_id,
    question: payload.question,
    choices: Array.isArray(payload.choices)
      ? payload.choices.filter((choice): choice is string => typeof choice === 'string')
      : []
  }
}

/**
 * Answer the real Ink question, not the normal chat composer. Number keys
 * select a choice; custom text opens Ink's Other input first. Each navigation
 * frame allows a render. isOpen must fence writes to this exact request ID so
 * expiry cannot accidentally submit a new chat message. No routing directives
 * belong in a user's answer.
 */
export function answerGuidedClarification(
  request: GuidedClarificationRequest,
  answer: string,
  transport: GuidedComposerTransport
): boolean {
  const text = sanitizeGuidedComposerText(answer).trim()
  if (!text || !transport.isOpen()) return false
  const index = request.choices.indexOf(answer)
  if (index >= 0 && index < 9) {
    transport.send(String(index + 1))
    return true
  }
  const keys = request.choices.length
    ? [
        ...Array<string>(request.choices.length).fill('\x1b[A'),
        ...Array<string>(request.choices.length).fill('\x1b[B'),
        '\r'
      ]
    : []
  const step = (offset: number) => {
    if (!transport.isOpen()) return
    if (offset < keys.length) {
      transport.send(keys[offset])
      transport.schedule(() => step(offset + 1), 80)
    } else {
      writeGuidedPrompt(text, transport)
    }
  }
  step(0)
  return true
}
