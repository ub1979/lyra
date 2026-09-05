import type { UltimateBuilderRunState, UltimateBuilderRunTask } from './api'

export function job(overrides: Partial<UltimateBuilderRunTask> = {}): UltimateBuilderRunTask {
  return {
    phase: 'researcher',
    label: 'Research',
    task_id: 'research-1',
    board: 'default',
    status: 'running',
    attempts: 0,
    last_error: '',
    last_activity_at: 100,
    ...overrides
  }
}

export function savedRun(tasks: UltimateBuilderRunTask[]): UltimateBuilderRunState {
  return {
    available: true,
    state: 'working',
    active: true,
    task_count: tasks.length,
    active_task_count: tasks.length,
    last_activity_at: 100,
    tasks
  }
}
