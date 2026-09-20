import { describe, expect, it } from "vitest";
import { readGuidedTeamSelection, saveGuidedTeamSelection, guidedTeamSelectionDirective } from "./guided-team-selection";
import { builderStartsOnOpen, guidedSetupSeed } from "./guided-project-setup";
import { guidedProjectTurnDirectives } from "./guided-agent-routing";

const seed = (mode: string, start = false) => `IDRAK_INTERNAL_SETUP_BEGIN ${JSON.stringify({ team_selection_mode: mode, start_on_open: start })} IDRAK_INTERNAL_SETUP_END`;

describe("chosen project team", () => {
  it("requires explicit guided choice, persists it per project, and ends it on confirmation", () => {
    const data = new Map<string, string>();
    const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
    expect(readGuidedTeamSelection(storage, "/custom", seed("manual"))).toBe("manual");
    expect(readGuidedTeamSelection(storage, "/guided", seed("guided"))).toBe("guided");
    expect(readGuidedTeamSelection(storage, "/guided", null)).toBe("guided");
    expect(readGuidedTeamSelection(storage, "/custom", null)).toBe("manual");
    expect(readGuidedTeamSelection(storage, "/legacy", null)).toBe("manual");
    saveGuidedTeamSelection(storage, "/guided", "manual");
    expect(readGuidedTeamSelection(storage, "/guided", null)).toBe("manual");
  });

  it("carries the same selection rule through setup and later turns", () => {
    for (const mode of ["manual", "guided"] as const) {
      const setup = guidedSetupSeed("/project", ["sw-developer"], {}, {}, {}, "personal", mode);
      const payload = JSON.parse(setup.replace(/^IDRAK_INTERNAL_SETUP_BEGIN /, "").replace(/ IDRAK_INTERNAL_SETUP_END$/, ""));
      const turns = guidedProjectTurnDirectives({ approvedAgentIds: ["sw-developer"], completed: [], current: null, models: {}, provider: "test", teamSelectionMode: mode });
      expect(payload.team_selection_gate).toBe(guidedTeamSelectionDirective(mode));
      expect(turns).toContain(payload.team_selection_gate);
      expect(payload.enabled_specialists).toEqual(["sw-developer"]);
    }
  });

  it("waits on empty new-project launch and preserves explicit brief or legacy launch", () => {
    expect(builderStartsOnOpen(seed("manual"))).toBe(false);
    expect(builderStartsOnOpen(seed("guided"))).toBe(false);
    expect(builderStartsOnOpen(seed("manual", true))).toBe(true);
    expect(builderStartsOnOpen(guidedSetupSeed("/old", [], {}, {}, {}))).toBe(true);
  });
});
