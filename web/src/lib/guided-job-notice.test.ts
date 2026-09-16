import { describe, expect, it } from "vitest";
import { guidedJobNotice } from "./guided-job-notice";

describe("guidedJobNotice", () => {
  it("turns a project_job status frame into one plain assistant line", () => {
    const notice = guidedJobNotice(
      {
        kind: "project_job",
        text: "Architecture attempt failed. Lyra queued a retry.",
        task_id: "t_1",
        event_kind: "timed_out",
        event_cursor: 7,
      },
      5_000,
    );
    expect(notice).toEqual({
      id: "job-notice-t_1:timed_out:7",
      role: "assistant",
      content: "Architecture attempt failed. Lyra queued a retry.",
      plain: true,
      createdAt: 5_000,
    });
  });

  it("ignores compression and process status frames", () => {
    expect(guidedJobNotice({ kind: "compacting", text: "…" })).toBeNull();
    expect(guidedJobNotice({ kind: "process", text: "finished" })).toBeNull();
    expect(guidedJobNotice({ kind: "project_job", text: "   " })).toBeNull();
    expect(guidedJobNotice(null)).toBeNull();
  });

  it("gives the same event the same id so a replay does not duplicate the line", () => {
    const frame = { kind: "project_job", text: "x", task_id: "t", event_kind: "crashed", event_cursor: 1 };
    expect(guidedJobNotice(frame, 1)?.id).toBe(guidedJobNotice(frame, 2)?.id);
  });
});
