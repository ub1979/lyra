import { describe, expect, it } from "vitest";
import { mergeGuidedResponse, type GuidedMergeMessage } from "./guided-response-merge";

const user: GuidedMergeMessage = { id: "u1", role: "user", content: "build the rest" };

describe("mergeGuidedResponse", () => {
  it("appends the first reply of a turn after the user's message", () => {
    const out = mergeGuidedResponse([user], "On it.", 1, 1_000, "a1");
    expect(out.map((m) => m.id)).toEqual(["u1", "a1"]);
    expect(out[1]).toMatchObject({ role: "assistant", content: "On it.", turn: 1 });
  });

  it("refines a reply completed twice within the same turn", () => {
    const first = mergeGuidedResponse([user], "partial", 1, 1_000, "a1");
    const out = mergeGuidedResponse(first, "partial and complete", 1, 2_000, "a2");
    expect(out).toHaveLength(2);
    expect(out[1]).toMatchObject({ id: "a1", content: "partial and complete" });
  });

  it("keeps the previous reply when a new turn answers without a user message in between", () => {
    // A saved-job notification starts its own turn; its reply must not erase the last one.
    const first = mergeGuidedResponse([user], "Queue restarted.", 1, 1_000, "a1");
    const out = mergeGuidedResponse(first, "That was the completion notice.", 2, 2_000, "a2");
    expect(out.map((m) => m.content)).toEqual([
      "build the rest",
      "Queue restarted.",
      "That was the completion notice.",
    ]);
  });

  it("never overwrites a quiet notice or approval line", () => {
    const notice: GuidedMergeMessage = {
      id: "job-notice-1",
      role: "assistant",
      content: "Architecture attempt failed. Retry queued.",
      plain: true,
      turn: 3,
    };
    const out = mergeGuidedResponse([user, notice], "Here is the plan.", 3, 3_000, "a3");
    expect(out).toHaveLength(3);
    expect(out[1]).toBe(notice);
  });

  it("treats replies restored without a turn as separate messages", () => {
    const restored: GuidedMergeMessage = { id: "old", role: "assistant", content: "earlier" };
    const out = mergeGuidedResponse([restored], "new reply", 1, 1_000, "a1");
    expect(out.map((m) => m.content)).toEqual(["earlier", "new reply"]);
  });
});
