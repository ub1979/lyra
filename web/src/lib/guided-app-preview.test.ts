import { describe, expect, it } from "vitest";

import {
  buildVisualFeedbackPrompt,
  normalizePreviewUrl,
} from "./guided-app-preview";

describe("normalizePreviewUrl", () => {
  it("adds HTTP to a local address", () => {
    expect(normalizePreviewUrl("localhost:5173")).toBe(
      "http://localhost:5173",
    );
  });

  it("preserves an explicit scheme", () => {
    expect(normalizePreviewUrl("https://127.0.0.1:3000/app")).toBe(
      "https://127.0.0.1:3000/app",
    );
  });
});

describe("buildVisualFeedbackPrompt", () => {
  it("keeps structured element context hidden behind a concise display message", () => {
    const result = buildVisualFeedbackPrompt({
      workspace: "/tmp/project",
      url: "http://localhost:5173",
      viewport: "mobile (390px)",
      elements: [
        {
          id: "one",
          selector: "main > button:nth-of-type(1)",
          tag: "button",
          text: "Buy now",
          role: "button",
          accessibleName: "Buy now",
          html: "<button>Buy now</button>",
          rect: { x: 10, y: 20, width: 100, height: 40 },
          styles: { color: "rgb(0, 0, 0)" },
          comment: " Make this calmer ",
        },
      ],
      consoleEntries: [],
    });

    expect(result.prompt).toContain('"kind": "visual_element_feedback"');
    expect(result.prompt).toContain('"instruction": "Make this calmer"');
    expect(result.prompt).toContain("delegate only to specialists that are actually needed");
    expect(result.display).toBe(
      "Visual feedback for 1 selected element:\n• main > button:nth-of-type(1) — Make this calmer",
    );
    expect(result.display).not.toContain("computed_styles");
  });
});
