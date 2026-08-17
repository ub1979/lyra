import { describe, expect, it } from "vitest";

import {
  analyzeGuidedChatOutput,
  extractAppItSkillSelection,
  friendlyActivityLabel,
  guidedResponseNeedsContinuation,
  presentGuidedChatOutput,
  sanitizeGuidedResponse,
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

  it("removes inline reasoning and tool transcripts from structured responses", () => {
    const response = sanitizeGuidedResponse(
      "I’m preparing the architecture. " +
        "├─ ▾ Thinking ~152 tokens └─ Internal chain of thought. " +
        "├─ ▾ Tool calls (1) └─ ● Delegate Task(\"Build plan.md\") (0.1s) " +
        "└─ Σ ~253 total Architecture is now underway.",
    );

    expect(response).toBe(
      "I’m preparing the architecture. Architecture is now underway.",
    );
    expect(response).not.toContain("Thinking");
    expect(response).not.toContain("Tool calls");
    expect(response).not.toContain("Delegate Task");
  });

  it("presents only one complete question at a time", () => {
    const response = sanitizeGuidedResponse(
      "Great idea. **Who are the main users?** Is this for yourself or a team, and how many people will use it?",
    );

    expect(response).toBe("Great idea. **Who are the main users?**");
  });

  it("does not truncate reports that contain questions", () => {
    const response = sanitizeGuidedResponse(
      "## Review\n\nDoes the release meet the requirements?\n\nYes. All smoke checks passed and the evidence is recorded below.",
    );

    expect(response).toContain("All smoke checks passed");
  });

  it("does not mistake casual mentions of coding for a phase change", () => {
    const presentation = analyzeGuidedChatOutput(
      "Summarize the requirements for approval before any coding.",
    );

    expect(presentation.specialist).toBeNull();
  });

  it("continues narrated specialist handoffs without crossing approvals", () => {
    expect(
      guidedResponseNeedsContinuation(
        "Architecture playbook loaded. Delegating to a specialist subagent to produce plan.md.",
      ),
    ).toBe(true);
    expect(
      guidedResponseNeedsContinuation(
        "The plan is ready. Does this look right? Reply approve to continue.",
      ),
    ).toBe(false);
    expect(
      guidedResponseNeedsContinuation("Your application is ready to use."),
    ).toBe(false);
    expect(
      guidedResponseNeedsContinuation(
        "Quick preview ready — open .sdlc/preview/index.html. Does this look like what you want?",
      ),
    ).toBe(false);
  });

  it("prefers the delegated role over later artifact mentions", () => {
    const presentation = analyzeGuidedChatOutput(
      "You are the Task Planner. Produce task-graph.md with development and QA assignments.",
    );

    expect(presentation.specialist).toEqual({
      id: "task-planner",
      label: "Task planning",
    });
  });

  it("consumes App IT team markers and keeps only registered specialists", () => {
    expect(
      extractAppItSkillSelection(
        "Good choice. I’ll use that team. [APP_IT_SKILLS_SET:req-engineer,sw-developer,unknown,sw-developer]",
        ["req-engineer", "sw-developer", "qa-engineer"],
      ),
    ).toEqual({
      content: "Good choice. I’ll use that team.",
      skillIds: ["req-engineer", "sw-developer"],
    });
    expect(
      extractAppItSkillSelection("App IT only. [APP_IT_SKILLS_SET:]", [
        "req-engineer",
      ]),
    ).toEqual({ content: "App IT only.", skillIds: [] });
    expect(
      extractAppItSkillSelection(
        "Team set. [APP_IT_SKILLS_SET:ultimate-builder:sw-developer,Quality assurance]",
        ["sw-developer", "qa-engineer"],
      ),
    ).toEqual({
      content: "Team set.",
      skillIds: ["sw-developer", "qa-engineer"],
    });
  });

  it("never shows App IT control markers in guided responses", () => {
    expect(
      sanitizeGuidedResponse(
        "Team updated. [APP_IT_SKILLS_SET:req-engineer,qa-engineer]",
      ),
    ).toBe("Team updated.");
  });

  it("never infers a team from prose without the control marker", () => {
    // Regression: prose inference used to replace an explicit multi-skill
    // selection with a guess drawn from one sentence, so "I'll add a login
    // page for the developer" plus a bare "ok" collapsed the team to one.
    // The marker is now the only authority.
    expect(
      extractAppItSkillSelection(
        "Sure - I'll add a login page and get a developer on it.",
        ["req-engineer", "sw-developer", "qa-engineer"],
      ),
    ).toBeNull();
    expect(
      extractAppItSkillSelection(
        "My recommended team is Requirements, Development, and Quality assurance.",
        ["req-engineer", "sw-developer", "qa-engineer"],
      ),
    ).toBeNull();
  });
});

describe("friendlyActivityLabel", () => {
  it("extracts a label from a tool.start payload with context", () => {
    const label = friendlyActivityLabel(
      { name: "Write", context: "Writing /Users/u/funcoding/project/src/App.tsx", args_text: '{"path":"src/App.tsx"}' },
      false,
    );
    expect(label).toBe("Writing src/App.tsx");
    expect(label).not.toContain("/Users/");
  });

  it("extracts a label from a tool.start with only a name", () => {
    const label = friendlyActivityLabel({ name: "Bash" }, false);
    expect(label).toBe("Running a command");
  });

  it("extracts a label from a subagent event with a goal", () => {
    const label = friendlyActivityLabel(
      { goal: "Build the login page component" },
      true,
    );
    expect(label).toBe("Build the login page component");
  });

  it("extracts a label from a subagent tool event", () => {
    const label = friendlyActivityLabel(
      { tool_name: "Write", tool_preview: "/Users/u/project/src/App.tsx" },
      true,
    );
    expect(label).toBe("Writing: App.tsx");
  });

  it("never cuts a question the agent is asking the user", () => {
    // The activity indicator is where the user reads this while the turn runs.
    const question =
      "Asking Should publishing be blocked outright whenever the legal-safety " +
      "or platform-policy check fails, or should it warn and let the author " +
      "publish anyway with a recorded override?";
    const label = friendlyActivityLabel(
      { context: question, name: "clarify" },
      false,
    );
    expect(label).toBe(question);
    expect(label).not.toMatch(/…/);
  });

  it("keeps a question whole even from a tool it does not know", () => {
    const question = "A".repeat(60) + " which environment should this target?";
    expect(friendlyActivityLabel({ context: question, name: "mystery" }, false)).toBe(
      question,
    );
  });

  it("puts a multi-line question on one wrapped line instead of dropping the rest", () => {
    const label = friendlyActivityLabel(
      {
        context: "Asking which do you prefer?\n\n1. Postgres\n2. SQLite",
        name: "clarify",
      },
      false,
    );
    expect(label).toBe("Asking which do you prefer? 1. Postgres 2. SQLite");
  });

  it("keeps a subagent question whole too", () => {
    const question = "Which of these two layouts should I build first?".padStart(
      120,
      "x ",
    );
    expect(
      friendlyActivityLabel({ summary: question, tool_name: "clarify" }, true),
    ).toBe(question.replace(/\s+/g, " ").trim());
  });

  it("cuts a long status label at a word boundary, not mid-word", () => {
    const source =
      "Running a command that installs every dependency in the monorepo workspace right now";
    const label = friendlyActivityLabel({ context: source }, false);

    expect(label!.length).toBeLessThanOrEqual(80);
    expect(label).toMatch(/…$/);

    // What survived is a whole-word prefix: the source continues with a space.
    const body = label!.slice(0, -1);
    expect(source.startsWith(body)).toBe(true);
    expect(source[body.length]).toBe(" ");
  });

  it("truncates long text to 80 chars", () => {
    const label = friendlyActivityLabel(
      { context: "A".repeat(100) },
      false,
    );
    expect(label!.length).toBeLessThanOrEqual(80);
    expect(label).toMatch(/…$/);
  });

  it("strips newlines from payload text", () => {
    const label = friendlyActivityLabel(
      { context: "Writing file\nwith many details\nand more" },
      false,
    );
    expect(label).toBe("Writing file");
  });

  it("returns null when payload has no useful fields", () => {
    expect(friendlyActivityLabel({}, false)).toBeNull();
    expect(friendlyActivityLabel(null, false)).toBeNull();
    expect(friendlyActivityLabel(undefined, true)).toBeNull();
  });

  it("prefers summary over goal for subagent events", () => {
    const label = friendlyActivityLabel(
      { goal: "implement auth", summary: "Finished login page" },
      true,
    );
    expect(label).toBe("Finished login page");
  });
});
