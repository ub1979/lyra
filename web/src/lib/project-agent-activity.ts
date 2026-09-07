import type { UltimateBuilderRunState, UltimateBuilderRunTask } from './api'
import { needsTechnicalReview } from './project-attention'

export interface ProjectAgentActivityItem {
  id: string
  phase: string
  label: string
  status: string
  detail: string
  running: boolean
  attention: boolean
  lastActivityAt: number | null
}

const STATUS_LABELS: Record<string, string> = {
  running: 'Working',
  ready: 'Queued to start',
  todo: 'Waiting for earlier work',
  scheduled: 'Scheduled',
  blocked: 'Needs attention',
  triage: 'Needs attention',
  done: 'Completed',
  archived: 'Stopped / archived'
}

/** Saved job identity/state is authoritative; prose and phase plans are not. */
function presentTask(task: UltimateBuilderRunTask, stale: boolean): ProjectAgentActivityItem {
  const paused = task.status === 'blocked' && task.paused_by_user
  const status = task.dispatch_issue
    ? 'Cannot start automatically'
    : paused
      ? 'Paused by you'
      : needsTechnicalReview(task)
        ? 'Waiting for Lyra to review'
        : task.status === 'blocked' && task.block_kind === 'needs_input'
          ? 'Waiting for your input'
          : (STATUS_LABELS[task.status] ?? 'Status unknown')
  return {
    id: `${task.board}:${task.task_id}`,
    phase: task.phase,
    label: task.label,
    status: stale ? `Last known: ${status}` : status,
    detail: needsTechnicalReview(task)
      ? 'The worker has paused for a technical check. Use Review with Lyra above the message box; you do not need to inspect code.'
      : task.status === 'triage'
        ? 'This step has paused repeatedly. Ask Lyra to explain the problem before trying again.'
        : task.dispatch_issue ||
          (task.status === 'blocked' || task.status === 'triage'
            ? paused
              ? 'Use Resume workers to continue.'
              : task.wait_reason || task.last_error || 'Ask Lyra what is needed to continue.'
            : ''),
    running: !stale && task.status === 'running',
    attention: !stale && !paused && (Boolean(task.dispatch_issue) || ['blocked', 'triage'].includes(task.status)),
    lastActivityAt: task.last_activity_at
  }
}

export function projectAgentActivity(state: UltimateBuilderRunState | null, stale = false): ProjectAgentActivityItem[] {
  // Rebuild from each snapshot, including terminal states. This restores the
  // sidebar on reload without replaying chat events or retaining phantom jobs.
  return (state?.tasks ?? []).map(task => presentTask(task, stale))
}

/** Agent Activity is a live surface; history and queued work belong to the map. */
export function activeProjectAgentActivity(items: readonly ProjectAgentActivityItem[]): ProjectAgentActivityItem[] {
  return items.filter(item => item.running)
}

export function projectAgentSummary(items: readonly ProjectAgentActivityItem[], chatWorkers = 0): string {
  const running = items.filter(item => item.running).length + chatWorkers
  const attention = items.filter(item => item.attention).length
  const queued = items.filter(item =>
    ['Queued to start', 'Waiting for earlier work', 'Scheduled'].includes(item.status)
  ).length
  return (
    [
      running ? `${running} working` : '',
      attention ? `${attention} need attention` : '',
      queued ? `${queued} queued` : ''
    ]
      .filter(Boolean)
      .join(' · ') || (items.length ? 'Saved jobs' : 'No active work')
  )
}

/** A chat turn alone does not prove any background worker is running. */
export function coordinatorActivityMessage(items: readonly ProjectAgentActivityItem[], chatWorkers = 0): string {
  if (items.some(item => item.attention)) {
    return 'I’m handling your message. Some project work needs attention; see Project agents for its saved status.'
  }
  if (chatWorkers || items.some(item => item.running)) {
    return 'I’m handling your message while the project agents work in the background.'
  }
  return 'I’m handling your message. Project agents are shown separately when they have work to do.'
}
