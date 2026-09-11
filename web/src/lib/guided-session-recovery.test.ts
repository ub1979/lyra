import { describe, expect, it } from "vitest";

import type { SessionMessage } from "@/lib/api";

import {
  mergeRecoveredGuidedSessionTail,
  recoverGuidedSessionTail,
  recoverGuidedUserContent,
} from "./guided-session-recovery";

describe("guided session recovery", () => {
  it("restores the latest saved Lyra reply and ignores tool output", () => {
    const messages: SessionMessage[] = [
      { role: "assistant", content: "The design is ready for review.", id: 10 },
      {
        role: "tool",
        tool_name: "patch",
        content: "a//project/file → b//project/file\n@@ -1 +1 @@\n-old\n+new",
        id: 11,
      },
      {
        role: "user",
        content:
          "IDRAK_INTERNAL_PROJECT_TASK_UPDATE: saved job changed\nJob data: {}",
        id: 12,
      },
      {
        role: "assistant",
        content: "Do you approve this refined design direction?",
        timestamp: 1_789_128_697,
        id: 13,
      },
    ];

    expect(recoverGuidedSessionTail(messages)).toEqual([
      {
        id: "session-assistant-13",
        role: "assistant",
        content: "Do you approve this refined design direction?",
        createdAt: 1_789_128_697_000,
      },
    ]);
  });

  it("does not restore a persisted patch as Lyra's reply", () => {
    const messages: SessionMessage[] = [
      {
        role: "assistant",
        content:
          "a//Users/u/project/requirements.md → b//Users/u/project/requirements.md\n@@ -1 +1 @@\n-Draft\n+Approved",
        id: 20,
      },
      {
        role: "user",
        content:
          "IDRAK_INTERNAL_PLAIN_LANGUAGE: keep this simple\nIDRAK_INTERNAL_MODEL_ROUTING: {}\nIDRAK_INTERNAL_REQUIREMENTS_ROUTING: approved\nplease continue",
        id: 21,
      },
    ];

    expect(recoverGuidedSessionTail(messages).map((message) => message.role)).toEqual([
      "user",
      "error",
    ]);
    expect(recoverGuidedSessionTail(messages)[0]?.content).toBe("please continue");
  });

  it("hides internal notifications and extracts the person's text", () => {
    expect(
      recoverGuidedUserContent(
        "IDRAK_INTERNAL_PROJECT_TASK_UPDATE: changed\nJob data: {\"status\":\"done\"}",
      ),
    ).toBe("");
    expect(
      recoverGuidedUserContent(
        "[[ IDRAK_INTERNAL_S.. [1 lines] .. .\"} IDRAK_INTERNAL_SETUP_END ]]\n" +
          "IDRAK_INTERNAL_PLAIN_LANGUAGE: speak plainly\n" +
          "IDRAK_INTERNAL_MODEL_ROUTING: {}\n" +
          "IDRAK_INTERNAL_REQUIREMENTS_ROUTING: approved\n" +
          "i approve it",
      ),
    ).toBe("i approve it");
  });

  it("adds a missed canonical reply to stale browser history once", () => {
    const local = [
      {
        id: "local-old",
        role: "assistant" as const,
        content: "Research is running.",
      },
    ];
    const recovered = [
      {
        id: "session-new",
        role: "assistant" as const,
        content: "Do you approve the refined design direction?",
      },
    ];

    const merged = mergeRecoveredGuidedSessionTail(local, recovered);
    expect(merged.map((message) => message.content)).toEqual([
      "Research is running.",
      "Do you approve the refined design direction?",
    ]);
    expect(mergeRecoveredGuidedSessionTail(merged, recovered)).toEqual(merged);
  });

  it("does not append a recovered unanswered turn over live browser chat", () => {
    const local = [
      { id: "live", role: "user" as const, content: "new message" },
    ];
    const unanswered = [
      { id: "old", role: "user" as const, content: "old message" },
      { id: "old-error", role: "error" as const, content: "retry" },
    ];

    expect(mergeRecoveredGuidedSessionTail(local, unanswered)).toEqual(local);
  });
});
