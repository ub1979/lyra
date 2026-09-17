import { describe, expect, it } from "vitest";
import { guidedSetupSeed } from "./guided-project-setup";
import { guidedProjectTurnDirectives } from "./guided-agent-routing";
import { recoverGuidedUserContent } from "./guided-session-recovery";

describe("first user turn setup", () => {
  it("retains project context but recovers only the actual user's request", () => {
    const seed = guidedSetupSeed("/project", ["researcher"], {}, {}, { researcher: "Research" });
    const payload = JSON.parse(seed.replace(/^IDRAK_INTERNAL_SETUP_BEGIN /, "").replace(/ IDRAK_INTERNAL_SETUP_END$/, ""));
    expect(payload.workspace).toBe("/project");
    expect(payload.enabled_specialists).toEqual(["researcher"]);
    expect(payload.user_request).toBeUndefined();
    const routing = guidedProjectTurnDirectives({ approvedAgentIds: ["researcher"], completed: [], current: null, models: {}, provider: "mock" });
    expect(recoverGuidedUserContent([...routing, seed, "Where are we?\nPlease just explain."].join("\n")))
      .toBe("Where are we?\nPlease just explain.");
  });

  it("keeps old automatic setup messages hidden", () => {
    expect(recoverGuidedUserContent(guidedSetupSeed("/old", [], {}, {}, {}))).toBe("");
  });
});
