import { useState } from 'react'
import type { GuidedClarificationRequest } from '../lib/guided-clarification'

export interface GuidedClarificationProps {
  request: GuidedClarificationRequest
  sending: boolean
  error?: string
  onAnswer: (answer: string) => void
}

/** Studio presentation for the existing TUI question, not a second chat. */
export function GuidedClarification({ request, sending, error, onAnswer }: GuidedClarificationProps) {
  const [answer, setAnswer] = useState('')
  return (
    <section
      aria-label="Lyra needs your answer"
      className="max-h-[45vh] shrink-0 overflow-y-auto border-b border-current/15 bg-background-base px-4 py-3 text-text-primary"
    >
      <strong role="status" className="block text-midground">{sending ? 'Sending your answer…' : 'Lyra needs your answer'}</strong>
      {error && <p role="alert" className="mt-2 text-text-primary">{error}</p>}
      <p className="mt-2 whitespace-pre-wrap break-words">{request.question}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {request.choices.map((choice, index) => (
          <button
            key={index}
            type="button"
            disabled={sending}
            onClick={() => onAnswer(choice)}
            className="max-w-full whitespace-normal break-words rounded-2xl border border-current/20 bg-midground/5 px-3 py-2 text-left disabled:opacity-50"
          >
            {choice}
          </button>
        ))}
      </div>
      <form
        className="mt-3 flex flex-wrap items-end gap-2"
        onSubmit={event => {
          event.preventDefault()
          if (!sending && answer.trim()) onAnswer(answer)
        }}
      >
        <label className="min-w-0 flex-1 basis-48">
          <span className="text-sm text-text-secondary">Or write your own answer</span>
          <textarea
            value={answer}
            disabled={sending}
            onChange={event => setAnswer(event.target.value)}
            rows={2}
            className="mt-1 block w-full rounded-xl border border-current/20 bg-background-base p-2"
          />
        </label>
        <button
          type="submit"
          disabled={sending || !answer.trim()}
          className="rounded-full bg-midground px-4 py-2 text-background-base disabled:opacity-50"
        >
          {sending ? 'Sending…' : 'Send answer'}
        </button>
      </form>
      <p className="mt-2 text-sm text-text-secondary">{sending
        ? 'Waiting for confirmation from Lyra. Your answer will be confirmed here.'
        : 'Lyra will continue once it receives your answer.'}</p>
    </section>
  )
}
