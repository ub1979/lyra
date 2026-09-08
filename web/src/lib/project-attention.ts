import type { UltimateBuilderRunTask } from './api'

/** Backward-compatible classification for jobs saved before attention_kind. */
export function needsTechnicalReview(task: UltimateBuilderRunTask): boolean {
  return task.status === 'blocked' && !task.paused_by_user && (
    task.attention_kind === 'review' || /^review-required:/i.test((task.wait_reason ?? '').trim())
  )
}
