import { describe, expect, it } from "vitest";
import {
  guidedApprovalChoices,
  guidedApprovalChoiceFromText,
  guidedApprovalKey,
  guidedApprovalMessage,
  guidedModelRoutingTurnDirective,
  guidedPhaseContinuationDirective,
  guidedPlainLanguageTurnDirective,
  guidedProjectExecutionTurnDirective,
  guidedProjectTurnDirectives,
  guidedRequirementsTurnDirective,
  unavailableGuidedModelAssignments,
} from "./guided-agent-routing";

describe("guidedPlainLanguageTurnDirective", () => {
  it("repairs technical status language in existing project conversations", () => {
    const directive = guidedPlainLanguageTurnDirective();
    expect(directive).toMatch(/non-technical user/i);
    expect(directive).toMatch(/whether the whole application is finished/i);
    expect(directive).toMatch(/does not mean the whole application is finished/i);
  });
});

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

describe("guidedProjectExecutionTurnDirective", () => {
  it("routes an in-scope bug through diagnosis, implementation, and exact QA", () => {
    const directive = guidedProjectExecutionTurnDirective([
      "debugger",
      "sw-developer",
      "qa-engineer",
    ]);

    expect(directive).toContain(
      '"approved_agents":["debugger","sw-developer","qa-engineer"]',
    );
    expect(directive).toMatch(/classify this user message before using tools/i);
    expect(directive).toMatch(/first owner is Debugging/i);
    expect(directive).toMatch(/then Development/i);
    expect(directive).toMatch(/finally QA/i);
    expect(directive).toMatch(/exact user-reported journey/i);
  });

  it("keeps specialist work out of the foreground conversation", () => {
    const directive = guidedProjectExecutionTurnDirective(["sw-developer"]);

    expect(directive).toMatch(/durable background project job/i);
    expect(directive).toMatch(/do not load specialist playbooks/i);
    expect(directive).toMatch(/do not edit application files/i);
    expect(directive).toMatch(/immediately tell the user which agent owns it/i);
  });

  it("does not silently activate a missing agent or misuse Requirements", () => {
    const directive = guidedProjectExecutionTurnDirective(["qa-engineer"]);

    expect(directive).toMatch(/ask to add it/i);
    expect(directive).toMatch(/genuinely new or unclear/i);
    expect(directive).toMatch(/Requirements/i);
  });
});

describe("guidedProjectTurnDirectives", () => {
  it("always includes live execution routing, even when agent routing is disabled", () => {
    const directives = guidedProjectTurnDirectives({
      approvedAgentIds: ["debugger"],
      completed: [],
      current: null,
      includeRequirements: false,
      models: {},
      provider: "openai-codex",
    });

    expect(directives.some((item) => item.includes("PROJECT_EXECUTION"))).toBe(true);
    expect(directives.some((item) => item.includes("REQUIREMENTS_ROUTING"))).toBe(
      false,
    );
  });
});

describe("guidedPhaseContinuationDirective", () => {
  it("keeps Requirements interactive", () => {
    expect(
      guidedPhaseContinuationDirective("req-engineer", "Requirements"),
    ).toMatch(/interactive Requirements phase now in this conversation/i);
  });

  it("queues every non-interactive phase and returns the foreground chat", () => {
    const directive = guidedPhaseContinuationDirective("debugger", "Debugging");
    expect(directive).toMatch(/queueing debugger as a durable background project job/i);
    expect(directive).toMatch(/do not load its playbook/i);
    expect(directive).toMatch(/end this foreground turn/i);
  });
});

describe("guidedModelRoutingTurnDirective", () => {
  it("binds explicit agent models to the active provider and supersedes old context", () => {
    const directive = guidedModelRoutingTurnDirective("claude-cli", {
      researcher: "claude-sonnet-4-6",
    });
    expect(directive).toContain('"provider":"claude-cli"');
    expect(directive).toContain('"researcher":"claude-sonnet-4-6"');
    expect(directive).toContain('"researcher":"claude-cli"');
    expect(directive).toMatch(/replaces every earlier model assignment/i);
  });

  it("makes an empty map explicitly mean Follow project model", () => {
    expect(guidedModelRoutingTurnDirective("claude-cli", {})).toMatch(
      /missing specialist model means Follow project model/i,
    );
  });
});

describe("unavailableGuidedModelAssignments", () => {
  it("asks for a replacement instead of guessing across providers", () => {
    expect(
      unavailableGuidedModelAssignments(
        {
          "tech-writer": "claude-haiku-4-5",
          "qa-engineer": "gpt-5.4-mini",
        },
        ["tech-writer", "qa-engineer"],
        ["gpt-5.4", "gpt-5.4-mini"],
      ),
    ).toEqual([
      { agentId: "tech-writer", model: "claude-haiku-4-5" },
    ]);
  });

  it("does not report inactive agents or an inconclusive custom inventory", () => {
    expect(
      unavailableGuidedModelAssignments(
        { docs: "claude-haiku-4-5" },
        [],
        ["gpt-5.4-mini"],
      ),
    ).toEqual([]);
    expect(
      unavailableGuidedModelAssignments(
        { docs: "local-model" },
        ["docs"],
        [],
      ),
    ).toEqual([]);
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

  it("falls back safely when a backend sends an empty choice list", () => {
    expect(guidedApprovalChoices({ choices: [], allowPermanent: false })).toEqual([
      "once",
      "session",
      "deny",
    ]);
  });

  it("presents approval in the transcript and accepts an explicit typed reply", () => {
    const choices = ["once", "deny"] as const;
    const message = guidedApprovalMessage("May I run the checks?", choices, "npm test");
    expect(message).toContain("May I run the checks?");
    expect(message).toContain("Action: npm test");
    expect(message).toContain("Type your choice below: Allow once, Deny.");
    expect(guidedApprovalChoiceFromText(choices, "Allow once")).toBe("once");
    expect(guidedApprovalChoiceFromText(choices, "2")).toBe("deny");
    expect(guidedApprovalChoiceFromText(choices, "please continue")).toBeNull();
  });

  it("never resolves a choice that the backend did not offer", () => {
    expect(guidedApprovalChoiceFromText(["once", "deny"], "always")).toBeNull();
  });
});
