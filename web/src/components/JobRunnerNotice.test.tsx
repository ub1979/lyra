import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { JobRunnerNotice } from "./JobRunnerNotice";

const down = {
  state: "unavailable" as const,
  message: "The job runner is not running, so queued jobs cannot start yet.",
  last_tick_at: null,
};
const noop = () => Promise.resolve();

describe("Studio job runner notice", () => {
  it("offers to start the runner when a saved job is waiting and the runner is down", () => {
    const html = renderToStaticMarkup(
      <JobRunnerNotice runner={down} tasks={[{ status: "ready" }]} startRunner={noop} />,
    );
    expect(html).toContain("queued but cannot start yet");
    expect(html).toContain("Start job runner");
  });

  it("renders nothing once the runner reports a fresh tick", () => {
    const html = renderToStaticMarkup(
      <JobRunnerNotice
        runner={{ state: "running", message: "ok", last_tick_at: 1 }}
        tasks={[{ status: "ready" }]}
        startRunner={noop}
      />,
    );
    expect(html).toBe("");
  });

  it("shows progress without a second button while a start is in flight", () => {
    const html = renderToStaticMarkup(
      <JobRunnerNotice runner={down} tasks={[{ status: "ready" }]} startRunner={noop} initialStart="starting" />,
    );
    expect(html).toContain("Starting the job runner");
    expect(html).not.toContain("Start job runner</button>");
  });
});
