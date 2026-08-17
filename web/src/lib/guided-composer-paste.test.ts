import { describe, expect, it } from "vitest";
import {
  GUIDED_BRACKETED_PASTE_MIN_LENGTH,
  guidedComposerEnterDelayMs,
  guidedComposerPayload,
  guidedNeedsBracketedPaste,
  sanitizeGuidedComposerText,
  writeGuidedPrompt,
} from "./guided-composer-paste";

const START = "\u001b[200~";
const END = "\u001b[201~";

function fakeTransport(open = true) {
  const sent: string[] = [];
  const scheduled: Array<{ delayMs: number; run: () => void }> = [];
  return {
    scheduled,
    sent,
    transport: {
      isOpen: () => open,
      schedule: (run: () => void, delayMs: number) =>
        scheduled.push({ delayMs, run }),
      send: (data: string) => sent.push(data),
    },
  };
}

describe("sanitizeGuidedComposerText", () => {
  it("keeps newlines and tabs, which are literal inside a paste", () => {
    expect(sanitizeGuidedComposerText("a\n\tb")).toBe("a\n\tb");
  });

  it("normalises carriage returns, which would submit early", () => {
    expect(sanitizeGuidedComposerText("one\r\ntwo\rthree")).toBe(
      "one\ntwo\nthree",
    );
  });

  it("strips nested paste markers that would end the paste early", () => {
    expect(sanitizeGuidedComposerText(`before${END}after`)).toBe(
      "beforeafter",
    );
    expect(sanitizeGuidedComposerText(`${START}x`)).toBe("x");
  });

  it("strips other control characters", () => {
    expect(sanitizeGuidedComposerText("a\u0007b\u0000c\u007f")).toBe("abc");
  });
});

describe("guidedNeedsBracketedPaste", () => {
  it("is true for anything multi-line — the bug this fixes", () => {
    expect(guidedNeedsBracketedPaste("build me an app\nuse the QA specialist")).toBe(
      true,
    );
  });

  it("is true for long single-line prompts, which race the Enter", () => {
    expect(
      guidedNeedsBracketedPaste("x".repeat(GUIDED_BRACKETED_PASTE_MIN_LENGTH)),
    ).toBe(true);
  });

  it("is false for a short one-liner, which keeps the old path", () => {
    expect(guidedNeedsBracketedPaste("add a dark mode toggle")).toBe(false);
  });
});

describe("guidedComposerPayload", () => {
  it("wraps a multi-line prompt so the whole thing is one message", () => {
    const prompt = "Build a landing page.\n\n- use Development\n- then QA";
    expect(guidedComposerPayload(prompt)).toBe(`${START}${prompt}${END}`);
  });

  it("leaves a short one-liner untouched", () => {
    expect(guidedComposerPayload("hello")).toBe("hello");
  });

  it("sanitises before deciding, so a lone CR does not force a paste", () => {
    expect(guidedComposerPayload("hello\r")).toBe("hello\n".trimEnd());
  });
});

describe("guidedComposerEnterDelayMs", () => {
  it("keeps the original delay for small payloads", () => {
    expect(guidedComposerEnterDelayMs(20)).toBe(80);
  });

  it("grows with payload size", () => {
    expect(guidedComposerEnterDelayMs(5_000)).toBeGreaterThan(
      guidedComposerEnterDelayMs(500),
    );
  });

  it("is bounded so a huge paste cannot stall the turn", () => {
    expect(guidedComposerEnterDelayMs(10_000_000)).toBe(600);
  });
});

describe("writeGuidedPrompt", () => {
  it("writes the payload, then Enter, in that order", () => {
    const { scheduled, sent, transport } = fakeTransport();
    const payload = writeGuidedPrompt("line one\nline two", transport);

    expect(sent).toEqual([payload]);
    expect(payload.startsWith(START)).toBe(true);

    expect(scheduled).toHaveLength(1);
    scheduled[0].run();
    expect(sent).toEqual([payload, "\r"]);
  });

  it("scales the Enter delay to the payload it just wrote", () => {
    const { scheduled, transport } = fakeTransport();
    writeGuidedPrompt("x".repeat(4_000), transport);
    expect(scheduled[0].delayMs).toBe(guidedComposerEnterDelayMs(4_000 + START.length + END.length));
  });

  it("skips Enter when the socket closed while waiting", () => {
    const { scheduled, sent, transport } = fakeTransport(false);
    writeGuidedPrompt("hello", transport);
    scheduled[0].run();
    expect(sent).toEqual(["hello"]);
  });
});
