import { describe, expect, it } from "vitest";
import { coordinatorStatusLabel } from "./coordinator-status";
import { normalizeGuidedUsage, updateGuidedWorkers } from "./guided-agent-runtime";

describe("coordinator status and unknown usage", () => {
  it("follows disconnect, reconnect and foreground work independently of workers", () => {
    expect(coordinatorStatusLabel({ connection: "open", eventsConnected: true, working: true })).toBe("Lyra working");
    expect(coordinatorStatusLabel({ connection: "closed", eventsConnected: false, working: true })).toBe("Lyra disconnected");
    expect(coordinatorStatusLabel({ connection: "open", eventsConnected: false, working: true })).toBe("Lyra reconnecting");
    expect(coordinatorStatusLabel({ connection: "open", eventsConnected: true, working: false })).toBe("Lyra ready");
  });

  it("does not convert null counters or spawn activity into reported zero usage", () => {
    expect(normalizeGuidedUsage({ input: null, output: null }).reported).toBe(false);
    expect(normalizeGuidedUsage({ input: 0 }).reported).toBe(true);
    const spawned = updateGuidedWorkers([], "subagent.started", { subagent_id: "w" }, 10);
    expect(spawned[0].reported).toBe(false);
    const measured = updateGuidedWorkers(spawned, "subagent.progress", { subagent_id: "w", input_tokens: 5 }, 20);
    expect(measured[0].reported).toBe(true);
    expect(updateGuidedWorkers(measured, "subagent.progress", { subagent_id: "w" }, 30)[0].reported).toBe(true);
  });
});
