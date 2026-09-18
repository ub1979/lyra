/** Expanded pastes stay literal when queued; explicit /queue commands remain strings. */
export interface LiteralPrompt {
  text: string
}
export type QueuedPrompt = string | LiteralPrompt
export const promptText = (prompt: QueuedPrompt): string => (typeof prompt === 'string' ? prompt : prompt.text)
