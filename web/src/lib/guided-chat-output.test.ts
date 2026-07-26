import { describe, expect, it } from "vitest";

import {
  analyzeGuidedChatOutput,
  presentGuidedChatOutput,
} from "./guided-chat-output";

describe("presentGuidedChatOutput", () => {
  it("hides tool calls, paths, and file diffs while work is running", () => {
    const transcript = `
┊ Let me start by inspecting the workspace.
└─ ▾ Tool calls (2)
├─ ● Terminal("Running ls -la /Users/u/funcoding/todo")
└─ ● Write File("Writing /Users/u/funcoding/todo/index.html")
a//Users/u/funcoding/todo/index.html → b//Users/u/funcoding/todo/index.html
@@ -0,0 +1,271 @@
+<!DOCTYPE html>`;

    const output = presentGuidedChatOutput(transcript);

    expect(output).toBe("I’m building your project…");
    expect(output).not.toContain("Tool calls");
    expect(output).not.toContain("/Users/");
    expect(output).not.toContain("<!DOCTYPE");
  });

  it("shows only the agent's final response", () => {
    const transcript = `
└─ ▾ Tool calls (1)
└─ ● Terminal("npm test")
└─ Response
┊ Your todo app is ready.
┊
┊ Open it in your browser and add your first task.
❯ `;

    expect(presentGuidedChatOutput(transcript)).toBe(
      "Your todo app is ready.\n\nOpen it in your browser and add your first task.",
    );
  });

  it("keeps concise requirements questions as chat", () => {
    const transcript = `
└─ Response
┊ Great idea. Before I build it:
┊ 1. Should tasks have due dates?
┊ 2. Is this for one person or a team?`;

    expect(presentGuidedChatOutput(transcript)).toContain(
      "Should tasks have due dates?",
    );
  });

  it("identifies the specialist currently working", () => {
    const presentation = analyzeGuidedChatOutput(`
└─ ▾ Tool calls (1)
└─ ● Write File("Writing requirements.md")
`);

    expect(presentation.phase).toBe("working");
    expect(presentation.specialist).toEqual({
      id: "req-engineer",
      label: "Requirements",
    });
  });
});
