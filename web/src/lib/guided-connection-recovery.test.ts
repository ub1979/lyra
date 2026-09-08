import { describe, expect, it } from "vitest";
import {
  clearRecoveredGuidedConnectionErrors,
  isTransientGuidedConnectionSetupError,
} from "./guided-connection-recovery";

describe("isTransientGuidedConnectionSetupError", () => {
  it("recognizes browser fetch failures caused by a temporary restart", () => {
    expect(
      isTransientGuidedConnectionSetupError(new TypeError("Failed to fetch")),
    ).toBe(true);
    expect(
      isTransientGuidedConnectionSetupError(new TypeError("Load failed")),
    ).toBe(true);
  });

  it("does not hide authorization or application setup errors", () => {
    expect(
      isTransientGuidedConnectionSetupError(
        new Error("/api/auth/ws-ticket: HTTP 401"),
      ),
    ).toBe(false);
    expect(
      isTransientGuidedConnectionSetupError(new TypeError("invalid URL")),
    ).toBe(false);
  });
});

describe("clearRecoveredGuidedConnectionErrors", () => {
  it("removes only obsolete chat-connection errors after reconnect", () => {
    const messages = [
      { role: "user", content: "continue" },
      {
        role: "error",
        content: "The project chat could not connect: Failed to fetch",
      },
      { role: "error", content: "The AI model returned an error: quota" },
      { role: "assistant", content: "I am back." },
    ];

    expect(clearRecoveredGuidedConnectionErrors(messages)).toEqual([
      { role: "user", content: "continue" },
      { role: "error", content: "The AI model returned an error: quota" },
      { role: "assistant", content: "I am back." },
    ]);
  });

  it("preserves the original array when no recovered error exists", () => {
    const messages = [{ role: "error", content: "A real model error" }];
    expect(clearRecoveredGuidedConnectionErrors(messages)).toBe(messages);
  });
});
