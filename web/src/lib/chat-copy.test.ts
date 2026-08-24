import { describe, expect, it } from "vitest";
import {
  COPY_FEEDBACK_MS,
  chatMessageCopyText,
  chatMessageIsCopyable,
  copyButtonLabel,
} from "./chat-copy";

describe("chatMessageCopyText", () => {
  it("keeps Lyra's markdown exactly as written", () => {
    const markdown = [
      "Here is the fix:",
      "",
      "```bash",
      "npm run build -w web",
      "```",
      "",
      "- first",
      "- second",
      "",
      "**Done.**",
    ].join("\n");
    expect(chatMessageCopyText({ role: "assistant", content: markdown })).toBe(
      markdown,
    );
  });

  it("copies what the user typed, newlines and all", () => {
    const typed = "line one\nline two\n\nline four";
    expect(chatMessageCopyText({ role: "user", content: typed })).toBe(typed);
  });

  it("never leaks phase control markers into a paste", () => {
    const raw =
      "[APP_IT_PHASE:req-engineer]\nStarting requirements.\n[APP_IT_PHASE_DONE:spec]";
    expect(chatMessageCopyText({ role: "assistant", content: raw })).toBe(
      "Starting requirements.",
    );
  });

  it("strips the team-selection marker", () => {
    const raw = "Team picked.\n[APP_IT_SKILLS_SET:req-engineer,sw-architect]";
    expect(chatMessageCopyText({ role: "assistant", content: raw })).toBe(
      "Team picked.",
    );
  });

  it("strips the internal connection-error sentinel from an error bubble", () => {
    const raw = "[[IDRAK_MODEL_CONNECTION_ERROR]] The model did not respond.";
    expect(chatMessageCopyText({ role: "error", content: raw })).toBe(
      "The model did not respond.",
    );
  });

  it("collapses only the gap a stripped marker leaves behind", () => {
    const raw = "Intro\n\n[APP_IT_PHASE:spec]\n\nBody\n\nEnd";
    // The deliberate paragraph breaks survive; the marker's hole does not.
    expect(chatMessageCopyText({ role: "assistant", content: raw })).toBe(
      "Intro\n\nBody\n\nEnd",
    );
  });

  it("drops trailing spaces that would show up as diff noise", () => {
    expect(
      chatMessageCopyText({ role: "assistant", content: "one   \ntwo\t\n" }),
    ).toBe("one\ntwo");
  });

  it("survives a message with no content at all", () => {
    expect(chatMessageCopyText({ role: "assistant", content: "" })).toBe("");
    expect(
      chatMessageCopyText({
        role: "assistant",
        content: undefined as unknown as string,
      }),
    ).toBe("");
  });
});

describe("chatMessageIsCopyable", () => {
  it("offers the button when there is something to copy", () => {
    expect(chatMessageIsCopyable({ role: "user", content: "hello" })).toBe(true);
  });

  it("hides it rather than copying whitespace", () => {
    expect(chatMessageIsCopyable({ role: "assistant", content: "   \n\n" })).toBe(
      false,
    );
  });

  it("hides it for a message that was nothing but a control marker", () => {
    expect(
      chatMessageIsCopyable({
        role: "assistant",
        content: "[APP_IT_PHASE:spec]",
      }),
    ).toBe(false);
  });
});

describe("copyButtonLabel", () => {
  it("names who wrote the message so screen readers can tell bubbles apart", () => {
    expect(copyButtonLabel("idle", "Lyra")).toBe("Copy Lyra message");
    expect(copyButtonLabel("idle", "your")).toBe("Copy your message");
  });

  it("confirms, and says what to do when the clipboard is blocked", () => {
    expect(copyButtonLabel("copied", "Lyra")).toBe("Copied");
    expect(copyButtonLabel("failed", "Lyra")).toMatch(/manually/);
  });
});

describe("COPY_FEEDBACK_MS", () => {
  it("is long enough to read and short enough not to linger", () => {
    expect(COPY_FEEDBACK_MS).toBeGreaterThanOrEqual(1000);
    expect(COPY_FEEDBACK_MS).toBeLessThanOrEqual(3000);
  });
});
