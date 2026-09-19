import { describe, expect, it } from "vitest";
import { reduceGuidedEvent } from "./guided-event-reducer";
import { INITIAL_GUIDED_STATE, type GuidedEventContext } from "./guided-event-state";
import { guidedStructuredFeedEstablished, type GuidedChatPresentation } from "./guided-chat-output";
import { terminalPresentation } from "./guided-terminal-authority";

const context: GuidedEventContext = {
  appItSpecialist: { id: "app-it", label: "Lyra" },
  defaultSpecialist: { id: "app-it", label: "Lyra" },
  clarificationPending: false,
  agentName: (id) => id,
  labelFor: (id) => id,
  newId: (prefix) => prefix,
  now: 1000,
  selectableSpecialistIds: [],
  selectedSpecialistIds: [],
};
const idle: GuidedChatPresentation = { phase: "idle", text: "", specialist: null };

describe("terminal paint versus structured turn authority", () => {
  it("cannot mark an accepted first request ready while the provider is running", () => {
    const state = reduceGuidedEvent(INITIAL_GUIDED_STATE, { type: "message.start" }, context).state;
    const result = terminalPresentation(state.activity, idle, true, state.turnSettled);
    expect(result).toBe(state.activity);
    expect(result.phase).toBe("working");
  });

  it("does not retake authority during a structured transport reconnect", () => {
    const established = guidedStructuredFeedEstablished(true, "disconnected");
    const state = reduceGuidedEvent(INITIAL_GUIDED_STATE, {
      type: "session.info", payload: { running: true },
    }, context).state;
    expect(terminalPresentation(state.activity, idle, established, false)).toBe(state.activity);
  });

  it("does not revive a completed turn from old terminal work", () => {
    const state = reduceGuidedEvent(INITIAL_GUIDED_STATE, {
      type: "message.complete", payload: { text: "Ready for your decision." },
    }, context).state;
    expect(terminalPresentation(state.activity, { ...idle, phase: "working" }, true, state.turnSettled))
      .toBe(state.activity);
    expect(state.turnSettled).toBe(true);
  });

  it("retains the terminal-only fallback before any structured feed exists", () => {
    const snapshot: GuidedChatPresentation = { ...idle, phase: "working", text: "Checking files" };
    expect(terminalPresentation(idle, snapshot, false, false)).toEqual(snapshot);
    expect(terminalPresentation(idle, snapshot, false, true)).toBe(idle);
  });
});
