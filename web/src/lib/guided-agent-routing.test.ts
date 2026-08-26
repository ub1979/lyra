import { describe, expect, it } from "vitest";
import {
  guidedApprovalChoices,
  guidedApprovalKey,
  guidedRequirementsTurnDirective,
  reconcileGuidedModelAssignments,
} from "./guided-agent-routing";

describe("guidedRequirementsTurnDirective", () => {
  it("activates requirements selectively before discovery starts", () => {
    const directive = guidedRequirementsTurnDirective({
      completed: [],
      current: null,
    });
    expect(directive).toMatch(/first meaningful product brief/i);
    expect(directive).toMatch(/do not start it for greetings/i);
  });

  it("does not restart an active requirements interview for side questions", () => {
    const directive = guidedRequirementsTurnDirective({
      completed: [],
      current: "req-engineer",
    });
    expect(directive).toMatch(/without reloading or restarting/i);
  });

  it("keeps ordinary turns with Lyra after requirements approval", () => {
    const directive = guidedRequirementsTurnDirective({
      completed: ["req-engineer"],
      current: null,
    });
    expect(directive).toMatch(/already approved/i);
    expect(directive).toMatch(/must not reactivate Requirements/i);
  });
});

describe("reconcileGuidedModelAssignments", () => {
  it("drops a stale Claude override after switching to OpenAI", () => {
    expect(
      reconcileGuidedModelAssignments(
        {
          "tech-writer": "claude-haiku-4-5",
          "qa-engineer": "gpt-5.4-mini",
        },
        ["gpt-5.4", "gpt-5.4-mini"],
      ),
    ).toEqual({
      models: { "qa-engineer": "gpt-5.4-mini" },
      removed: ["tech-writer"],
    });
  });

  it("preserves overrides when a custom provider inventory is unavailable", () => {
    expect(
      reconcileGuidedModelAssignments({ docs: "local-model" }, []),
    ).toEqual({ models: { docs: "local-model" }, removed: [] });
  });
});

describe("guided approvals", () => {
  it("matches the TUI choice order and numeric keys", () => {
    const choices = guidedApprovalChoices({ allowPermanent: true });
    expect(choices).toEqual(["once", "session", "always", "deny"]);
    expect(guidedApprovalKey(choices, "once")).toBe("1");
    expect(guidedApprovalKey(choices, "deny")).toBe("4");
  });

  it("honors restricted Smart approval choices", () => {
    const choices = guidedApprovalChoices({
      choices: ["once", "deny"],
      smartDenied: true,
    });
    expect(choices).toEqual(["once", "deny"]);
    expect(guidedApprovalKey(choices, "deny")).toBe("2");
    expect(guidedApprovalKey(choices, "always")).toBeNull();
  });
});
