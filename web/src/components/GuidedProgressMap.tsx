import { CheckCircle2, Map as MapIcon } from 'lucide-react'
import { guidedPhaseSummary, type GuidedPhaseStep } from '../lib/guided-phase-plan'
import { formatStudioDateTime, studioDateTimeIso } from '../lib/studio-time'
import { cn } from '../lib/utils'
import { GuidedAgentAvatar } from './GuidedAgentAvatar'

interface GuidedProgressMapProps {
  labels: Record<string, string>
  durable: boolean
  backgroundJobs: boolean
  steps: readonly GuidedPhaseStep[]
  updatedAt?: number | null
}

/** Responsive presentation of reported phase status, never an estimated timer. */
export function GuidedProgressMap({ durable, backgroundJobs, steps, labels, updatedAt }: GuidedProgressMapProps) {
  const summary = guidedPhaseSummary(steps)
  const current = steps.find(step => step.state === 'now') ?? null
  const blocked = steps.filter(step => step.state === 'blocked').length

  return (
    <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col overflow-x-hidden p-3 text-xs">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <span className="inline-flex shrink-0 items-center gap-1.5 font-semibold uppercase tracking-[0.16em] text-text-secondary">
          <MapIcon className="h-3.5 w-3.5" />
          <span>Project map</span>
        </span>
        <strong className="shrink-0 whitespace-nowrap rounded-full border border-current/15 px-2 py-0.5 text-[9px] uppercase tracking-wider text-midground">
          {backgroundJobs ? 'Saved progress' : durable ? 'Project record' : 'Chat signals'}
        </strong>
      </div>
      <p className="mt-2 text-[9px] leading-3 text-text-secondary">
        {backgroundJobs
          ? 'Delivery phases from saved progress and local evidence. Completed reports still need review; browser disconnects do not erase them.'
          : durable
            ? 'Saved phase reports with local evidence checks. No estimated percentage.'
            : 'Waiting for a project progress record; these are conversation signals only.'}
      </p>
      {updatedAt && (
        <time
          className="mt-1 block text-[9px] leading-3 text-text-secondary"
          dateTime={studioDateTimeIso(updatedAt * 1000)}
        >
          Last update {formatStudioDateTime(updatedAt * 1000)}
        </time>
      )}

      <div className="mt-3 grid min-w-0 grid-cols-2 gap-2">
        <div className="min-w-0 rounded-lg border border-emerald-500/25 bg-emerald-500/[0.07] p-2">
          <span className="block text-[9px] uppercase tracking-wider text-text-secondary">Done</span>
          <strong className="mt-0.5 block text-base text-emerald-400">{summary.completed}</strong>
        </div>
        <div className="min-w-0 rounded-lg border border-current/15 bg-background-base/60 p-2">
          <span className="block text-[9px] uppercase tracking-wider text-text-secondary">Open</span>
          <strong className="mt-0.5 block text-base text-midground">{summary.remaining}</strong>
        </div>
      </div>

      {blocked > 0 && (
        <p className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/[0.08] px-2 py-1.5 text-[10px] text-text-primary">
          {blocked} {blocked === 1 ? 'phase is' : 'phases are'} blocked
        </p>
      )}

      {current && (
        <div className="mt-2 rounded-lg border border-midground/30 bg-midground/[0.07] p-2.5">
          <span className="block text-[9px] uppercase tracking-wider text-text-secondary">Working now</span>
          <strong className="mt-1 flex items-center gap-2 text-[11px] text-midground">
            <GuidedAgentAvatar id={current.id} className="h-6 w-6 shrink-0 rounded-md object-cover" />
            <span className="min-w-0 whitespace-normal break-words">
              {current.label ?? labels[current.id] ?? current.id}
            </span>
          </strong>
        </div>
      )}

      <div className="mt-3 min-h-0 flex-1 overflow-y-auto pr-0.5">
        {steps.length ? (
          <ol aria-label="Project delivery map" className="space-y-1.5">
            {steps.map(step => (
              <li
                key={step.id}
                className={cn(
                  'flex min-w-0 flex-wrap items-start gap-2 rounded-2xl border px-2 py-1.5',
                  step.state === 'done'
                    ? 'border-emerald-500/20 bg-emerald-500/[0.05]'
                    : step.state === 'now'
                      ? 'border-midground/35 bg-midground/[0.08]'
                      : step.state === 'blocked'
                        ? 'border-amber-500/25 bg-amber-500/[0.07]'
                        : 'border-current/10 bg-background-base/45'
                )}
              >
                {step.state === 'done' ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                ) : (
                  <GuidedAgentAvatar
                    id={step.id}
                    muted={step.state === 'pending' || step.state === 'blocked'}
                    className="h-4 w-4 shrink-0 rounded object-cover"
                  />
                )}
                <span
                  className={cn(
                    'min-w-0 flex-1 basis-24 whitespace-normal break-words text-[10px]',
                    step.state === 'pending' || step.state === 'blocked'
                      ? 'text-text-secondary'
                      : 'font-semibold text-midground'
                  )}
                >
                  {step.label ?? labels[step.id] ?? step.id}
                </span>
                <span
                  className={cn(
                    'max-w-full whitespace-normal break-words text-[9px] font-semibold',
                    step.state === 'done'
                      ? 'text-emerald-400'
                      : step.state === 'now'
                        ? 'text-midground'
                        : step.state === 'blocked'
                          ? 'text-text-primary'
                          : 'text-text-secondary/70'
                  )}
                >
                  {step.state === 'done'
                    ? 'Done'
                    : step.state === 'now'
                      ? 'Now'
                      : step.state === 'blocked'
                        ? 'Blocked'
                        : (step.status ?? 'Next')}
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="rounded-lg border border-dashed border-current/15 p-3 text-[10px] leading-4 text-text-secondary">
            Lyra will build this map after you confirm the project agents.
          </p>
        )}
      </div>
    </div>
  )
}
