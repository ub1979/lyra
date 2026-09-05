import { encodePromptAnswerFrame, MAX_PROMPT_ANSWER_LENGTH } from '@hermes/shared'
import { sanitizeGuidedComposerText, type GuidedComposerTransport } from './guided-composer-paste'

export interface GuidedClarificationRequest {
  requestId: string
  question: string
  choices: string[]
  answerProtocol?: string
}

export function readGuidedClarification(
  payload: { request_id?: unknown; question?: unknown; choices?: unknown; answer_protocol?: unknown } | undefined
): GuidedClarificationRequest | null {
  if (
    typeof payload?.request_id !== 'string' ||
    !payload.request_id ||
    typeof payload.question !== 'string' ||
    !payload.question.trim()
  )
    return null
  return {
    ...(typeof payload.answer_protocol === 'string' ? { answerProtocol: payload.answer_protocol } : {}),
    requestId: payload.request_id,
    question: payload.question,
    choices: Array.isArray(payload.choices)
      ? payload.choices.filter((choice): choice is string => typeof choice === 'string')
      : []
  }
}

/** Deliver one request-fenced frame; no timed navigation or trailing Enter. */
export function answerGuidedClarification(
  request: GuidedClarificationRequest,
  answer: string,
  transport: GuidedComposerTransport
): boolean {
  const text = sanitizeGuidedComposerText(answer).trim()
  if (request.answerProtocol !== 'atomic-v1') return false
  if (!text || !transport.isOpen() || text.length > MAX_PROMPT_ANSWER_LENGTH) return false
  try {
    transport.send(encodePromptAnswerFrame({ requestId: request.requestId, answer: text }))
    return true
  } catch {
    return false
  }
}
