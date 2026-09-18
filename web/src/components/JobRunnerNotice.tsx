import { useEffect, useState } from "react";
import { Button } from "@nous-research/ui/ui/components/button";
import { api } from "@/lib/api";
import {
  jobRunnerNotice,
  nextJobRunnerStart,
  waitingJobCount,
  type JobRunnerHealth,
  type JobRunnerStart,
} from "@/lib/job-runner-notice";

export interface JobRunnerNoticeProps {
  runner: JobRunnerHealth | null | undefined;
  tasks: readonly { status?: string }[] | undefined;
  /** Injected for tests; defaults to the managed `hermes gateway start`. */
  startRunner?: () => Promise<unknown>;
  initialStart?: JobRunnerStart;
}

/**
 * Tell the user when queued work cannot start, and offer to start the job
 * runner. The action runs the existing managed gateway start (a LaunchAgent on
 * macOS); it never starts a second dispatcher inside the dashboard.
 */
export function JobRunnerNotice({
  runner,
  tasks,
  startRunner = api.startGateway,
  initialStart = "idle",
}: JobRunnerNoticeProps) {
  const [requested, setRequested] = useState<JobRunnerStart>(initialStart);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // A slow clock only while starting, so a start that never takes effect
  // turns into a visible failure instead of waiting forever.
  useEffect(() => {
    if (requested !== "starting") return;
    const timer = window.setInterval(() => setNow(Date.now()), 5_000);
    return () => window.clearInterval(timer);
  }, [requested]);

  // Derived each render from the latest backend health: a fresh tick ends
  // "starting", and the timeout turns it into "failed".
  const start = nextJobRunnerStart(requested, runner, startedAt, now);
  const notice = jobRunnerNotice(runner, waitingJobCount(tasks), start);
  if (!notice) return null;

  const onStart = () => {
    const at = Date.now();
    setRequested("starting");
    setStartedAt(at);
    setNow(at);
    startRunner().catch(() => setRequested("failed"));
  };

  return (
    <div
      role="status"
      aria-label="Job runner"
      className={
        notice.tone === "warning"
          ? "rounded-lg border border-warning/40 bg-warning/10 p-2 text-[11px] leading-4"
          : "rounded-lg border border-current/15 p-2 text-[11px] leading-4 text-text-secondary"
      }
    >
      <p>{notice.text}</p>
      {notice.canStart && (
        <Button size="sm" className="mt-2 h-7 px-2 text-[11px]" onClick={onStart}>
          Start job runner
        </Button>
      )}
    </div>
  );
}
