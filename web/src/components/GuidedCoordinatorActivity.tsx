import { useEffect, useState } from 'react'
import { Bot } from 'lucide-react'

export interface GuidedCoordinatorActivityProps {
  text: string
  lastSignalAt: number
  runningTool: { label: string; startedAt: number } | null
  onRetry: () => void
  waitingForInput?: boolean
  sendingAnswer?: boolean
  compacting?: boolean
}

/** This card belongs to the chat coordinator, never a role inferred from prose. */
export function GuidedCoordinatorActivity({
  text,
  lastSignalAt,
  runningTool,
  onRetry,
  waitingForInput = false,
  sendingAnswer = false,
  compacting = false
}: GuidedCoordinatorActivityProps) {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])
  const silentSeconds = Math.max(0, Math.floor((now - lastSignalAt) / 1000))
  const toolSeconds = runningTool ? Math.max(0, Math.floor((now - runningTool.startedAt) / 1000)) : 0
  // Summarizing emits a heartbeat every 60s. Keep its actual operation visible
  // between heartbeats; an elapsed timer alone does not prove a stalled model.
  const mayBeStalled = !waitingForInput && !runningTool && !compacting && silentSeconds >= 30
  const summaryQuiet = compacting && silentSeconds >= 90
  return (
    <section
      aria-label="Lyra chat activity"
      className="mt-2 min-w-0 rounded-xl border border-current/15 bg-midground/5 p-2.5"
    >
      <div className="flex min-w-0 items-start gap-2">
        <Bot aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-midground" />
        <div className="min-w-0 break-words [overflow-wrap:anywhere]">
          <div role="status">
            <strong className="block text-midground">
              {sendingAnswer
                ? 'Sending your answer…'
                : waitingForInput
                  ? 'Lyra is waiting for your answer'
                  : compacting
                    ? 'Lyra is summarizing your conversation'
                    : 'Lyra is handling your message'}
            </strong>
            <p className="mt-1 text-text-secondary">
              {sendingAnswer
                ? 'Waiting for Lyra to confirm it received your answer.'
                : compacting && !waitingForInput
                  ? 'This is a normal step in a long chat and can take a few minutes. Lyra will continue automatically when the summary is ready.'
                  : waitingForInput
                    ? 'Answer the question shown in Studio to continue.'
                    : (runningTool?.label ?? (text || 'Thinking about your message…'))}
            </p>
          </div>
          {compacting && !waitingForInput && (
            <p className="mt-1 text-text-secondary">
              {summaryQuiet ? 'No recent update from the summarizing step.' : 'Summarizing is in progress.'} Last update{' '}
              {silentSeconds}s ago.
            </p>
          )}
          {mayBeStalled && (
            <p className="mt-1 text-text-secondary">
              Waiting for the next update from the AI model · {silentSeconds}s since its last update.
            </p>
          )}
          {runningTool && !waitingForInput && (
            <p className="mt-1 text-text-secondary">Tool running · {toolSeconds}s elapsed</p>
          )}
          {!waitingForInput && (mayBeStalled || summaryQuiet || toolSeconds >= 30) && (
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
