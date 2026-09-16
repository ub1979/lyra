import { describe, expect, it } from "vitest";

import { INITIAL_GUIDED_STATE, type GuidedEventContext, type GuidedEventState } from "./guided-event-state";
import { reduceGuidedToolEvent } from "./guided-tool-events";
import { GUIDED_TOOL_SILENCE_GRACE_MS } from "./guided-turn-watchdog";

const LYRA = { id: "app-it", label: "Lyra" };
const ctx = (now = 1_000): GuidedEventContext => ({
  agentName: (id) => id,
  appItSpecialist: LYRA,
  clarificationPending: false,
  defaultSpecialist: LYRA,
  labelFor: () => undefined,
  newId: (p) => p,
  now,
  selectableSpecialistIds: ["researcher"],
  selectedSpecialistIds: ["researcher"],
});

const step = (state: GuidedEventState, type: string, payload: unknown, now = 1_000) =>
  reduceGuidedToolEvent(state, type, payload, ctx(now)) ?? state;

describe("reduceGuidedToolEvent", () => {
  it("tracks a tool from start to completion with a bounded deadline", () => {
    let state = step(INITIAL_GUIDED_STATE, "tool.start", { name: "read_file", tool_id: "t1" });
    expect(state.activeTools.get("t1")).toMatchObject({ name: "read_file", deadline: 1_000 + GUIDED_TOOL_SILENCE_GRACE_MS });
    expect(state.turnSettled).toBe(false);
    expect(state.activity.phase).toBe("working");

    state = step(state, "tool.progress", { tool_id: "t1" }, 5_000);
    expect(state.activeTools.get("t1")?.deadline).toBe(5_000 + GUIDED_TOOL_SILENCE_GRACE_MS);

    state = step(state, "tool.complete", { tool_id: "t1" }, 6_000);
    expect(state.activeTools.size).toBe(0);
    expect(state.lastSignalAt).toBe(6_000);
  });

  it("id-less progress extends every active tool; name-only completion clears by name", () => {
    let state = step(INITIAL_GUIDED_STATE, "tool.start", { name: "search_files" });
    state = step(state, "tool.start", { name: "terminal" }, 1_001);
    state = step(state, "tool.progress", {}, 9_000);
    expect([...state.activeTools.values()].every((t) => t.deadline === 9_000 + GUIDED_TOOL_SILENCE_GRACE_MS)).toBe(true);
    state = step(state, "tool.complete", { name: "terminal" });
    expect([...state.activeTools.values()].map((t) => t.name)).toEqual(["search_files"]);
  });

  it("subagent events extend the grace window and update workers; completion clears it", () => {
    let state = step(INITIAL_GUIDED_STATE, "subagent.start", { subagent_id: "sa-1", display_label: "Research" });
    expect(state.subagentGraceUntil).toBeGreaterThan(1_000);
    expect(state.workers.map((w) => w.label)).toEqual(["Research"]);
    state = step(state, "subagent.complete", { subagent_id: "sa-1" }, 2_000);
    expect(state.subagentGraceUntil).toBe(0);
    expect(state.workers[0].status).toBe("completed");
  });

  it("an approval request appends one plain line and reuses it for the same request", () => {
    const payload = { description: "Run the tests?", choices: ["once", "deny"], command: "npm test" };
    let state = step(INITIAL_GUIDED_STATE, "approval.request", payload);
    state = step(state, "approval.request", payload, 2_000);
    expect(state.messages).toHaveLength(1);
    expect(state.messages[0].plain).toBe(true);
    expect(state.approval?.command).toBe("npm test");
    expect(state.approvalSeq).toBe(1);
    expect(state.activity.text).toBe("Waiting for your approval…");
  });

  it("a clarify tool completion replaces the waiting label", () => {
    const state = step(INITIAL_GUIDED_STATE, "tool.complete", { name: "clarify" });
    expect(state.activity.text).toBe("Question handled. Continuing…");
  });

  it("returns null for events it does not own", () => {
    expect(reduceGuidedToolEvent(INITIAL_GUIDED_STATE, "message.start", {}, ctx())).toBeNull();
  });
});
