import { describe, expect, it } from "vitest";
import { guidedSetupSeed, profileFromBuilderSeed } from "./guided-project-setup";
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

  it("carries the user-selected build profile into a later setup seed", () => {
    const launch = `IDRAK_INTERNAL_SETUP_BEGIN ${JSON.stringify({ build_profile: "personal" })} IDRAK_INTERNAL_SETUP_END`;
    const profile = profileFromBuilderSeed(launch);
    expect(profile).toBe("personal");
    const seed = guidedSetupSeed("/project", ["qa-engineer"], {}, {}, {}, profile);
    const payload = JSON.parse(seed.replace(/^IDRAK_INTERNAL_SETUP_BEGIN /, "").replace(/ IDRAK_INTERNAL_SETUP_END$/, ""));
    expect(payload.build_profile).toBe("personal");
    expect(payload.preview_gate).toContain("project_run action=preview");
    expect(payload.preview_gate).toContain("preview_options");
    expect(payload.preview_gate).toContain("do not collect a separate informal approval");
    expect(payload.preview_gate).toContain("including Documentation");
    expect(payload.build_profile_gate).toContain("one real smoke QA work item");
    expect(payload.build_profile_gate).not.toContain("no build scale has been selected");
    expect(profileFromBuilderSeed("broken setup")).toBeNull();
  });
});
