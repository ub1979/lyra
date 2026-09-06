import type { ProjectAgentActivityItem } from '../lib/project-agent-activity'

export interface ProjectAgentJobsProps {
  items: readonly ProjectAgentActivityItem[]
  stale: boolean
}

/** Read-only live-agent projection; these durable IDs are not process controls. */
export function ProjectAgentJobs({ items, stale }: ProjectAgentJobsProps) {
  return (
    <div className="min-w-0 space-y-2" aria-label="Active project agents">
      {stale && (
        <p role="status" className="rounded-xl border border-current/15 p-2 text-text-secondary">
          Project status is temporarily unavailable. Showing the last saved update.
        </p>
      )}
      {items.map(item => (
        <article
          key={item.id}
          aria-label={`${item.label}: ${item.status}`}
          className="min-w-0 rounded-xl border border-current/15 bg-background-base/70 p-2.5"
        >
          <div className="flex min-w-0 items-start gap-2">
            <img
              src={`/skill-avatars/${encodeURIComponent(item.phase)}.webp`}
              alt=""
              className="h-7 w-7 shrink-0 rounded-lg object-cover"
              onError={event => {
                event.currentTarget.style.display = 'none'
              }}
            />
            <div className="min-w-0 flex-1 break-words [overflow-wrap:anywhere]">
              <strong className="block text-midground">{item.label}</strong>
              <span className="block text-text-primary">{item.status}</span>
            </div>
          </div>
          {item.detail && (
            <p className="mt-2 whitespace-pre-wrap break-words text-text-secondary [overflow-wrap:anywhere]">
              {item.detail}
            </p>
          )}
        </article>
      ))}
    </div>
  )
}
