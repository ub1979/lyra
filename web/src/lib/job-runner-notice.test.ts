import { describe, expect, it } from "vitest";
import {
  JOB_RUNNER_START_TIMEOUT_MS,
  jobRunnerNotice,
  nextJobRunnerStart,
  waitingJobCount,
  type JobRunnerHealth,
} from "./job-runner-notice";

const down: JobRunnerHealth = {
  state: "unavailable",
  message: "The job runner is not running, so queued jobs cannot start yet.",
  last_tick_at: null,
};
const unsure: JobRunnerHealth = { ...down, state: "unknown", message: "Lyra could not check the job runner." };
const up: JobRunnerHealth = { state: "running", message: "ok", last_tick_at: 100 };

describe("job runner notice", () => {
  it("says a queued job cannot start and offers the start action when the runner is down", () => {
    const notice = jobRunnerNotice(down, 1, "idle");
    expect(notice?.text).toContain("queued but cannot start yet");
    expect(notice?.canStart).toBe(true);
  });

  it("treats an unknown runner as a problem, never as healthy", () => {
    const notice = jobRunnerNotice(unsure, 2, "idle");
    expect(notice?.text).toContain("may not start");
    expect(notice?.canStart).toBe(true);
  });

  it("stays quiet when the runner is confirmed running or nothing is waiting", () => {
    expect(jobRunnerNotice(up, 3, "idle")).toBeNull();
    expect(jobRunnerNotice(down, 0, "idle")).toBeNull();
    expect(jobRunnerNotice(undefined, 3, "idle")).toBeNull();
  });

  it("disables the action while starting and re-offers it after a failed start", () => {
    expect(jobRunnerNotice(down, 1, "starting")?.canStart).toBe(false);
    const failed = jobRunnerNotice(down, 1, "failed");
    expect(failed?.canStart).toBe(true);
    expect(failed?.text).toContain("could not start");
  });
});

describe("job runner start progress", () => {
  it("finishes only when the backend reports a fresh dispatcher tick", () => {
    expect(nextJobRunnerStart("starting", down, 0, 1_000)).toBe("starting");
    expect(nextJobRunnerStart("starting", up, 0, 1_000)).toBe("idle");
  });

  it("does not call a later outage a failed start once a tick followed the start", () => {
    const stoppedAgain: JobRunnerHealth = { ...down, last_tick_at: 200, last_success_tick_at: 200 };
    const startedAt = 150_000;
    expect(nextJobRunnerStart("starting", stoppedAgain, startedAt, startedAt + JOB_RUNNER_START_TIMEOUT_MS + 1)).toBe("idle");
    expect(jobRunnerNotice(stoppedAgain, 1, "idle")?.text).toContain("queued but cannot start yet");
  });

  it("does not accept a fresh failed dispatch pass as a successful start", () => {
    const failedPass = { ...unsure, last_tick_at: 200, last_success_tick_at: 100 };
    expect(nextJobRunnerStart("starting", failedPass, 150_000, 200_000)).toBe("starting");
    expect(nextJobRunnerStart("starting", failedPass, 150_000, 250_000)).toBe("failed");
  });

  it("fails after the timeout instead of waiting forever", () => {
    expect(nextJobRunnerStart("starting", down, 0, JOB_RUNNER_START_TIMEOUT_MS + 1)).toBe("failed");
  });

  it("leaves idle and failed states alone", () => {
    expect(nextJobRunnerStart("idle", up, null, 5)).toBe("idle");
    expect(nextJobRunnerStart("failed", up, 0, 5)).toBe("failed");
  });
});

describe("waiting jobs", () => {
  it("counts only saved jobs that have not been claimed", () => {
    expect(
      waitingJobCount([{ status: "ready" }, { status: "todo" }, { status: "running" }, { status: "done" }]),
    ).toBe(2);
    expect(waitingJobCount(undefined)).toBe(0);
  });
});
