/** Atomic PTY answer envelope. Only the matching question may consume it. */
export interface PromptAnswerFrame {
  requestId: string
  answer: string
}

const PREFIX = 'LYRA_PROMPT_ANSWER_V1:'
export const MAX_PROMPT_ANSWER_LENGTH = 32_000

export function isPromptAnswerFrame(input: string): boolean {
  return input.includes(PREFIX)
}

export function encodePromptAnswerFrame(frame: PromptAnswerFrame): string {
  if (!frame.requestId || frame.answer.length > MAX_PROMPT_ANSWER_LENGTH) {throw new Error('Answer is too long')}

  return `\x1b[200~${PREFIX}${JSON.stringify(frame)}\x1b[201~`
}

export function decodePromptAnswerFrame(input: string): PromptAnswerFrame | null {
  const start = '\x1b[200~'
  const end = '\x1b[201~'
  let body = input.startsWith(start) ? input.slice(start.length) : input
  body = body.endsWith(end) ? body.slice(0, -end.length) : body

  if (!body.startsWith(PREFIX) || body.length > MAX_PROMPT_ANSWER_LENGTH * 6 + 2048) {return null}

  try {
    const frame = JSON.parse(body.slice(PREFIX.length)) as PromptAnswerFrame

    return typeof frame.requestId === 'string' && frame.requestId.length > 0 &&
      typeof frame.answer === 'string' && frame.answer.length <= MAX_PROMPT_ANSWER_LENGTH ? frame : null
  } catch {
    return null
  }
}
