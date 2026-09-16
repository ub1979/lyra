import { describe, expect, it } from "vitest";

import { guidedReplyWarning } from "./guided-reply-warning";

const NOT_SAVED =
  "History changed during this turn — the response above is visible but was not saved to session history.";

describe("guidedReplyWarning", () => {
  it("turns the gateway's warning into one plain amber line keyed by turn", () => {
    const line = guidedReplyWarning({ status: "complete", text: "hi", warning: NOT_SAVED }, 4, 1_000);
    expect(line).toEqual({
      id: "reply-warning-4",
      role: "assistant",
      content: NOT_SAVED,
      plain: true,
      tone: "warning",
      turn: 4,
      createdAt: 1_000,
    });
  });

  it("is silent when the completion carries no warning", () => {
    expect(guidedReplyWarning({ status: "complete", text: "hi" }, 1, 0)).toBeNull();
    expect(guidedReplyWarning({ warning: "   " }, 1, 0)).toBeNull();
    expect(guidedReplyWarning({ warning: 42 }, 1, 0)).toBeNull();
    expect(guidedReplyWarning(null, 1, 0)).toBeNull();
  });
});
