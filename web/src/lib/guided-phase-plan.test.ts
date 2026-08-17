import { describe, expect, it } from "vitest";
import {
  GUIDED_PHASE_ORDER,
  guidedPhaseAwaitsUser,
  guidedPhaseProgress,
  nextGuidedPhase,
  orderGuidedPhases,
  parseGuidedPhaseMarkers,
  shouldAdvanceGuidedPhase,
} from "./guided-phase-plan";

const ALLOWED = GUIDED_PHASE_ORDER;

describe("orderGuidedPhases", () => {
  it("puts a team into delivery order regardless of how it was selected", () => {
    expect(
      orderGuidedPhases(["qa-engineer", "req-engineer", "sw-developer"]),
    ).toEqual(["req-engineer", "sw-developer", "qa-engineer"]);
  });

  it("keeps ids it does not know, after the known ones", () => {
    expect(orderGuidedPhases(["mystery", "req-engineer"])).toEqual([
      "req-engineer",
      "mystery",
    ]);
  });
});

describe("parseGuidedPhaseMarkers", () => {
  it("strips the markers from what the user reads", () => {
    const raw =
      "[APP_IT_PHASE:sw-architect]Architecture is taking over now.";
    const parsed = parseGuidedPhaseMarkers(raw, ALLOWED);
    expect(parsed.content).toBe("Architecture is taking over now.");
    expect(parsed.started).toEqual(["sw-architect"]);
    expect(parsed.completed).toEqual([]);
  });

  it("does not read a completion as a start", () => {
    // [APP_IT_PHASE_DONE:x] contains the literal [APP_IT_PHASE: prefix.
    const parsed = parseGuidedPhaseMarkers(
      "[APP_IT_PHASE_DONE:req-engineer]requirements.md approved.",
      ALLOWED,
    );
    expect(parsed.completed).toEqual(["req-engineer"]);
    expect(parsed.started).toEqual([]);
    expect(parsed.content).toBe("requirements.md approved.");
  });

  it("handles a handover: one phase done, the next starting", () => {
    const parsed = parseGuidedPhaseMarkers(
      "[APP_IT_PHASE_DONE:req-engineer] Requirements approved. " +
        "[APP_IT_PHASE:sw-architect] Architecture is next.",
      ALLOWED,
    );
    expect(parsed.completed).toEqual(["req-engineer"]);
    expect(parsed.started).toEqual(["sw-architect"]);
    expect(parsed.content).toContain("Requirements approved.");
    expect(parsed.content).not.toContain("APP_IT_PHASE");
  });

  it("accepts the plugin-prefixed form and ignores unknown ids", () => {
    const parsed = parseGuidedPhaseMarkers(
      "[APP_IT_PHASE:ultimate-builder:qa-engineer][APP_IT_PHASE:ghost]x",
      ALLOWED,
    );
    expect(parsed.started).toEqual(["qa-engineer"]);
  });

  it("leaves ordinary replies untouched", () => {
    const parsed = parseGuidedPhaseMarkers("Just a normal answer.", ALLOWED);
    expect(parsed).toEqual({
      completed: [],
      content: "Just a normal answer.",
      started: [],
    });
  });
});

describe("nextGuidedPhase", () => {
  const ordered = ["req-engineer", "sw-developer", "qa-engineer"];

  it("starts at the head of the chain", () => {
    expect(nextGuidedPhase({ completed: [], current: null, ordered })).toBe(
      "req-engineer",
    );
  });

  it("does not skip a phase that started but has no artifact yet", () => {
    expect(
      nextGuidedPhase({ completed: [], current: "sw-developer", ordered }),
    ).toBe("sw-developer");
  });

  it("moves on once the current phase reports done", () => {
    expect(
      nextGuidedPhase({
        completed: ["req-engineer", "sw-developer"],
        current: "sw-developer",
        ordered,
      }),
    ).toBe("qa-engineer");
  });

  it("returns null when the chain is finished", () => {
    expect(
      nextGuidedPhase({ completed: ordered, current: "qa-engineer", ordered }),
    ).toBeNull();
  });
});

describe("guidedPhaseProgress", () => {
  it("marks done, now and pending for the strip", () => {
    expect(
      guidedPhaseProgress({
        completed: ["req-engineer"],
        current: "sw-developer",
        ordered: ["req-engineer", "sw-developer", "qa-engineer"],
      }),
    ).toEqual([
      { id: "req-engineer", state: "done" },
      { id: "sw-developer", state: "now" },
      { id: "qa-engineer", state: "pending" },
    ]);
  });
});

describe("guidedPhaseAwaitsUser", () => {
  it("holds on questions and approval gates", () => {
    expect(guidedPhaseAwaitsUser("Does this match what you wanted?")).toBe(true);
    expect(
      guidedPhaseAwaitsUser("requirements.md is ready for your approval."),
    ).toBe(true);
    expect(guidedPhaseAwaitsUser("The preview ready for you to open.")).toBe(
      true,
    );
    expect(guidedPhaseAwaitsUser("I am blocked on the API key.")).toBe(true);
  });

  it("does not hold on a plain progress report", () => {
    expect(
      guidedPhaseAwaitsUser("plan.md written and verified against the FRs."),
    ).toBe(false);
  });
});

describe("shouldAdvanceGuidedPhase", () => {
  it("advances when a phase reported done and another one is waiting", () => {
    expect(
      shouldAdvanceGuidedPhase({
        completedInReply: ["req-engineer"],
        next: "sw-developer",
        reply: "requirements.md written and verified.",
      }),
    ).toBe(true);
  });

  it("never advances past an approval gate", () => {
    expect(
      shouldAdvanceGuidedPhase({
        completedInReply: ["req-engineer"],
        next: "sw-developer",
        reply: "requirements.md is ready — approve it and I will continue?",
      }),
    ).toBe(false);
  });

  it("stays put when nothing reported done", () => {
    expect(
      shouldAdvanceGuidedPhase({
        completedInReply: [],
        next: "sw-developer",
        reply: "Working on it.",
      }),
    ).toBe(false);
  });

  it("stops at the end of the chain", () => {
    expect(
      shouldAdvanceGuidedPhase({
        completedInReply: ["tech-writer"],
        next: null,
        reply: "Docs written.",
      }),
    ).toBe(false);
  });

  it("does not re-nudge the phase that just finished", () => {
    expect(
      shouldAdvanceGuidedPhase({
        completedInReply: ["qa-engineer"],
        next: "qa-engineer",
        reply: "bug-report.md written.",
      }),
    ).toBe(false);
  });
});
