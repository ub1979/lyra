import type { UltimateBuilderRunState, UltimateBuilderRunTask } from '../lib/api'
import { needsProjectAttention, needsTechnicalReview } from '../lib/project-attention'

interface ProjectAttentionProps {
  state: UltimateBuilderRunState | null
  stale: boolean
  disabledReason?: string
  onReview: (task: UltimateBuilderRunTask) => void
}

/** Durable action panel independent of chat events and collapsible sidebars. */
export function ProjectAttention({ state, stale, disabledReason, onReview }: ProjectAttentionProps) {
  const tasks = (state?.tasks ?? []).filter(needsProjectAttention)
  if (!tasks.length && !stale) return null
  const unavailable = stale ? 'Reconnecting to project status. Actions will return when the status is current.' : disabledReason
  return (
    <section aria-label="Project needs attention" className="mx-auto mb-3 max-h-[30vh] max-w-3xl space-y-3 overflow-y-auto rounded-2xl border border-midground/25 bg-background-base p-4 text-sm text-text-primary">
      <p role="status" className="font-semibold text-midground">{stale ? 'Project status is temporarily unavailable' : 'Project needs attention'}</p>
      {stale && <p>Lyra cannot confirm the current worker status. Any work shown below is the last saved update, not a live result.</p>}
      {tasks.map(task => {
        const review = needsTechnicalReview(task)
        return (
          <article key={`${task.board}:${task.task_id}`} className="min-w-0 space-y-2 break-words [overflow-wrap:anywhere]">
            <h3 className="font-semibold">{review ? 'Work is ready for Lyra to review' : task.label}</h3>
            <p>{review
              ? 'This step has paused for a technical check. You do not need to read code or test reports. Lyra can check the work and explain what happens next.'
              : task.status === 'triage'
                ? 'This step has paused repeatedly. Ask Lyra to explain the problem before trying again.'
                : task.dispatch_issue || task.wait_reason || task.last_error || 'This job is paused. Ask Lyra to explain what is needed before it continues.'}</p>
            <button type="button" disabled={Boolean(unavailable)} onClick={() => onReview(task)}
              className="rounded-full border border-midground/30 bg-midground/10 px-4 py-2 font-semibold text-text-primary disabled:opacity-50">
              {review ? 'Review with Lyra' : 'Ask Lyra what is needed'}
            </button>
            {review && <p className="text-text-secondary">This asks for a review; it does not approve new work. To request a change, describe it in the chat below.</p>}
          </article>
        )
      })}
      {unavailable && <p className="text-text-secondary">{unavailable}</p>}
    </section>
  )
}
