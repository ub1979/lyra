import { describe, expect, it } from "vitest";
import {
  GUIDED_REQUIRED_SPECIALIST_IDS,
  isRequiredGuidedSpecialist,
  withRequiredGuidedSpecialists,
} from "./guided-required-specialists";

const ALLOWED = [
  "req-engineer",
  "spec",
  "sw-developer",
  "qa-engineer",
  "devops-engineer",
];

describe("GUIDED_REQUIRED_SPECIALIST_IDS", () => {
  it("pins the requirements engineer", () => {
    expect(GUIDED_REQUIRED_SPECIALIST_IDS).toContain("req-engineer");
    expect(isRequiredGuidedSpecialist("req-engineer")).toBe(true);
    expect(isRequiredGuidedSpecialist("sw-developer")).toBe(false);
  });
});

describe("withRequiredGuidedSpecialists", () => {
  it("adds requirements to a team that omitted it", () => {
    expect(withRequiredGuidedSpecialists(["sw-developer"], ALLOWED)).toEqual([
      "req-engineer",
      "sw-developer",
    ]);
  });

  it("keeps requirements when the team is cleared entirely", () => {
    expect(withRequiredGuidedSpecialists([], ALLOWED)).toEqual([
      "req-engineer",
    ]);
  });

  it("survives Lyra's own marker dropping it", () => {
    // [APP_IT_SKILLS_SET:sw-developer,qa-engineer]
    expect(
      withRequiredGuidedSpecialists(["sw-developer", "qa-engineer"], ALLOWED),
    ).toEqual(["req-engineer", "sw-developer", "qa-engineer"]);
  });

  it("lists requirements first so prompts and labels lead with it", () => {
    expect(
      withRequiredGuidedSpecialists(["qa-engineer", "req-engineer"], ALLOWED),
    ).toEqual(["req-engineer", "qa-engineer"]);
  });

  it("does not duplicate an already-present requirement", () => {
    expect(
      withRequiredGuidedSpecialists(
        ["req-engineer", "req-engineer", "spec"],
        ALLOWED,
      ),
    ).toEqual(["req-engineer", "spec"]);
  });

  it("drops ids the build does not know", () => {
    expect(
      withRequiredGuidedSpecialists(["sw-developer", "ghost"], ALLOWED),
    ).toEqual(["req-engineer", "sw-developer"]);
  });

  it("stays quiet when the playbook itself is gone", () => {
    // Renamed or retired upstream: pin nothing rather than name a dead skill.
    expect(withRequiredGuidedSpecialists(["spec"], ["spec"])).toEqual(["spec"]);
  });

  it("preserves the order of the rest of the team", () => {
    expect(
      withRequiredGuidedSpecialists(
        ["qa-engineer", "spec", "sw-developer"],
        ALLOWED,
      ),
    ).toEqual(["req-engineer", "qa-engineer", "spec", "sw-developer"]);
  });
});
