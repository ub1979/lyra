/**
 * What Studio says about the background job runner.
 *
 * The backend reports `running`, `unavailable` or `unknown` (never optimistic).
 * Studio only speaks up when jobs are waiting to start, and only offers the
 * start action while the runner is not confirmed running. Success is shown by
 * the notice disappearing once a fresh dispatcher tick reports `running`.
 */

export type JobRunnerState = "running" | "unavailable" | "unknown";

export interface JobRunnerHealth {
  state: JobRunnerState;
  message: string;
  last_tick_at: number | null;
  last_success_tick_at?: number | null;
}

/** Local progress of the user-initiated start action. */
export type JobRunnerStart = "idle" | "starting" | "failed";

export interface JobRunnerNotice {
  tone: "warning" | "info";
  text: string;
  canStart: boolean;
}

/** How long a start may take before Studio says it did not work. */
export const JOB_RUNNER_START_TIMEOUT_MS = 90_000;

export function jobRunnerNotice(
  runner: JobRunnerHealth | null | undefined,
  waitingJobs: number,
  start: JobRunnerStart,
): JobRunnerNotice | null {
  // Older backends do not report health; say nothing rather than guess.
  if (!runner || runner.state === "running") return null;
  if (start === "starting") {
    return {
      tone: "info",
      text: "Starting the job runner… Checking whether it can pick up queued work.",
      canStart: false,
    };
  }
  if (start === "failed") {
    return {
      tone: "warning",
      text: "Lyra could not start the job runner. Try again, or run `hermes gateway start` in a terminal.",
      canStart: true,
    };
  }
  if (waitingJobs < 1) return null;
  const lead =
    runner.state === "unavailable"
      ? "Your job is queued but cannot start yet."
      : "Your queued job may not start.";
  return { tone: "warning", text: `${lead} ${runner.message}`, canStart: true };
}

/** Advance the start action from what the backend reports. */
export function nextJobRunnerStart(
  start: JobRunnerStart,
  runner: JobRunnerHealth | null | undefined,
  startedAt: number | null,
  now: number,
): JobRunnerStart {
  if (start !== "starting") return start;
  if (runner?.state === "running") return "idle";
  // A successful pass after the start means the start worked, even if the
  // runner stops again later; that later stop is a new problem, not a failed start.
  if (startedAt !== null && runner?.last_success_tick_at != null && runner.last_success_tick_at * 1000 >= startedAt) {
    return "idle";
  }
  if (startedAt !== null && now - startedAt > JOB_RUNNER_START_TIMEOUT_MS) return "failed";
  return "starting";
}

/** Jobs saved and ready but not yet claimed by a worker. */
export function waitingJobCount(tasks: readonly { status?: string }[] | undefined): number {
  return (tasks ?? []).filter((task) => task.status === "ready" || task.status === "todo").length;
}
