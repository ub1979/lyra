import { useEffect, useState } from 'react'
import { Bot } from 'lucide-react'

export interface GuidedCoordinatorActivityProps {
  text: string
  lastSignalAt: number
  runningTool: { label: string; startedAt: number } | null
  onRetry: () => void
  waitingForInput?: boolean
}

/** This card belongs to the chat coordinator, never a role inferred from prose. */
export function GuidedCoordinatorActivity({
  text,
  lastSignalAt,
  runningTool,
  onRetry,
  waitingForInput = false
}: GuidedCoordinatorActivityProps) {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])
  const silentSeconds = Math.max(0, Math.floor((now - lastSignalAt) / 1000))
  const toolSeconds = runningTool ? Math.max(0, Math.floor((now - runningTool.startedAt) / 1000)) : 0
  const mayBeStalled = !waitingForInput && !runningTool && silentSeconds >= 30
  return (
    <section
      aria-label="Lyra chat activity"
      className="mt-2 min-w-0 rounded-xl border border-current/15 bg-midground/5 p-2.5"
    >
      <div className="flex min-w-0 items-start gap-2">
        <Bot aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-midground" />
        <div className="min-w-0 break-words [overflow-wrap:anywhere]">
          <strong className="block text-midground">
            {waitingForInput ? 'Lyra is waiting for your answer' : 'Lyra is handling your message'}
          </strong>
          <p className="mt-1 text-text-secondary">
            {waitingForInput
              ? 'Answer the question shown in Studio to continue.'
              : (runningTool?.label ??
                (mayBeStalled
                  ? 'Waiting for a fresh response from the AI model…'
                  : text || 'Thinking about your message…'))}
          </p>
          {runningTool && !waitingForInput && (
            <p className="mt-1 text-text-secondary">Tool running · {toolSeconds}s elapsed</p>
          )}
          {mayBeStalled && <p className="mt-1 text-text-secondary">No new activity for {silentSeconds}s.</p>}
          {!waitingForInput && (mayBeStalled || toolSeconds >= 30) && (
            <button
              type="button"
              className="mt-2 rounded-full border border-current/20 px-3 py-1 text-midground"
              onClick={onRetry}
            >
              {runningTool ? 'Stop tool & retry' : 'Stop & retry'}
            </button>
          )}
        </div>
      </div>
    </section>
  )
}
