import { describe, expect, it } from "vitest";
import type { GatewayEvent } from "@hermes/shared";

import { applyGuidedResponse, reduceGuidedEvent } from "./guided-event-reducer";
import {
  INITIAL_GUIDED_STATE,
  type GuidedEventContext,
  type GuidedEventState,
  type GuidedReduction,
} from "./guided-event-state";

const LYRA = { id: "app-it", label: "Lyra" };

function ctx(overrides: Partial<GuidedEventContext> = {}): GuidedEventContext {
  let counter = 0;
  return {
    agentName: (id, label) => label ?? id,
    appItSpecialist: LYRA,
    clarificationPending: false,
    defaultSpecialist: LYRA,
    labelFor: (id) => ({ researcher: "Research", "sw-architect": "Architecture" })[id],
    newId: (prefix) => `${prefix}-${++counter}`,
    now: 1_000,
    selectableSpecialistIds: ["researcher", "sw-architect", "sw-developer"],
    selectedSpecialistIds: ["researcher", "sw-architect"],
    ...overrides,
  };
}

function play(events: GatewayEvent[], context = ctx(), start = INITIAL_GUIDED_STATE) {
  const effects: GuidedReduction["effects"] = [];
  let state: GuidedEventState = start;
  for (const event of events) {
    const step = reduceGuidedEvent(state, event, context);
    state = step.state;
    effects.push(...step.effects);
  }
  return { effects, state };
}

const start: GatewayEvent = { type: "message.start" };
const complete = (text: string): GatewayEvent => ({ type: "message.complete", payload: { status: "complete", text } });

describe("reduceGuidedEvent — replies", () => {
  it("keeps both replies when a notification turn follows a user turn", () => {
    // The bug the 0.19.41 user saw: this sequence used to show one message.
    const { state } = play([start, complete("Queue restarted."), start, complete("That was the completion notice.")]);
    const replies = state.messages.filter((m) => m.role === "assistant" && !m.plain);
    expect(replies.map((m) => m.content)).toEqual(["Queue restarted.", "That was the completion notice."]);
    expect(replies.map((m) => m.turn)).toEqual([1, 2]);
    expect(state.activity.phase).toBe("idle");
    expect(state.turnSettled).toBe(true);
  });

  it("refines a reply completed twice within one turn instead of duplicating it", () => {
    const { state } = play([start, complete("partial"), complete("partial and complete")]);
    expect(state.messages).toHaveLength(1);
    expect(state.messages[0].content).toBe("partial and complete");
  });

  it("tolerates the gateway announcing one turn with two message.start frames", () => {
    const { state } = play([start, complete("A"), start, start, complete("B")]);
    expect(state.messages.map((m) => m.content)).toEqual(["A", "B"]);
  });

  it("uses streamed deltas when the completion carries no text", () => {
    const { state } = play([
      start,
      { type: "message.delta", payload: { text: "Hel" } },
      { type: "message.delta", payload: { text: "lo." } },
      { type: "message.complete", payload: { status: "complete" } },
    ]);
    expect(state.messages[0].content).toBe("Hello.");
    expect(state.streamedText).toBe("");
  });

  it("never calls the clock or random ids itself", () => {
    const { state } = play([start, complete("A"), start, complete("B")]);
    expect(state.messages.map((m) => m.id)).toEqual(["assistant-1", "assistant-2"]);
    expect(state.messages.every((m) => m.createdAt === 1_000)).toBe(true);
  });

  it("ignores an identical reply repeated in a later turn", () => {
    const { state } = play([start, complete("Same."), start, complete("Same.")]);
    expect(state.messages).toHaveLength(1);
  });
});

describe("reduceGuidedEvent — notices, compression, session, errors", () => {
  it("appends a quiet job notice once and never lets a reply overwrite it", () => {
    const notice: GatewayEvent = {
      type: "status.update",
      payload: { kind: "project_job", text: "Research attempt failed. Retry queued.", task_id: "t1", event_kind: "timed_out", event_cursor: 4 },
    };
    const { state } = play([start, complete("Working on it."), notice, notice, start, complete("Done.")]);
    expect(state.messages.map((m) => [m.content, Boolean(m.plain)])).toEqual([
      ["Working on it.", false],
      ["Research attempt failed. Retry queued.", true],
      ["Done.", false],
    ]);
  });

  it("a notice does not change what Lyra is doing or the turn count", () => {
    const { state } = play([start, { type: "status.update", payload: { kind: "project_job", text: "x", task_id: "t" } }]);
    expect(state.activity.phase).toBe("working");
    expect(state.turnSeq).toBe(1);
  });

  it("compression toggles the flag and touches no messages", () => {
    const { state } = play([
      start,
      complete("A"),
      { type: "status.update", payload: { kind: "compacting" } },
      { type: "status.update", payload: { kind: "compacted" } },
    ]);
    expect(state.compacting).toBe(false);
    expect(state.messages).toHaveLength(1);
    expect(state.activity.text).toBe("Conversation summarized. Continuing…");
  });

  it("session.info reports readiness, persists the session id and restores a running turn", () => {
    const { effects, state } = play([
      { type: "session.info", payload: { running: true, stored_session_id: " s-42 ", usage: { input: 10, calls: 1 } } },
    ]);
    expect(effects).toEqual([{ kind: "agentReady" }, { kind: "persistSessionId", sessionId: "s-42" }]);
    expect(state.activity.phase).toBe("working");
    expect(state.usage.input).toBe(10);
    expect(state.usage.reported).toBe(true);
  });

  it("session.info with an open approval does not fake a working state", () => {
    const withApproval = play([
      { type: "approval.request", payload: { description: "Run tests?", choices: ["once", "deny"] } },
      { type: "session.info", payload: { running: true } },
    ]);
    expect(withApproval.state.activity.text).toBe("Waiting for your approval…");
  });

  it("an error settles the turn, clears tools and approvals, and is appended once", () => {
    const err: GatewayEvent = { type: "error", payload: { message: "provider exploded" } };
    const { state } = play([start, { type: "tool.start", payload: { name: "read_file" } }, err, err]);
    expect(state.messages.filter((m) => m.role === "error")).toHaveLength(1);
    expect(state.turnSettled).toBe(true);
    expect(state.activeTools.size).toBe(0);
    expect(state.activity.phase).toBe("idle");
  });

  it("a failed completion without text becomes an error line", () => {
    const { state } = play([start, { type: "message.complete", payload: { status: "failed", failure_reason: "quota" } }]);
    expect(state.messages[0]).toMatchObject({ role: "error", content: "The AI model could not finish this response: quota" });
    expect(state.activity.phase).toBe("idle");
  });

  it("leaves unknown events alone", () => {
    const { effects, state } = play([{ type: "skin.changed" }, { type: "clarify.request" }]);
    expect(effects).toEqual([]);
    expect(state).toBe(INITIAL_GUIDED_STATE);
  });
});

describe("applyGuidedResponse — phases and hand-offs", () => {
  it("advances to the next selected phase and asks ChatPage to continue", () => {
    const { effects, state } = play([
      start,
      complete("[APP_IT_PHASE_DONE:researcher] Research is ready; architecture is next."),
    ]);
    expect(state.phasesCompleted).toEqual(["researcher"]);
    expect(effects.find((e) => e.kind === "autoContinue")).toMatchObject({ kind: "autoContinue", phase: "sw-architect" });
    expect(state.activity.text).toContain("Handing over to Architecture");
    expect(state.autoContinueCount).toBe(1);
  });

  it("stops handing over after the cap and explains itself", () => {
    const worn = { ...INITIAL_GUIDED_STATE, autoContinueCount: 24, turnSeq: 5 };
    const { effects, state } = play([complete("[APP_IT_PHASE_DONE:researcher] next")], ctx(), worn);
    expect(effects.some((e) => e.kind === "autoContinue")).toBe(false);
    expect(state.messages.at(-1)).toMatchObject({ role: "error" });
  });

  it("a team recommendation opens the dialog but does not change project state", () => {
    const { effects, state } = applyGuidedResponse(
      { ...INITIAL_GUIDED_STATE, turnSeq: 1 },
      "Here is my plan. [APP_IT_SKILLS_SET:researcher,sw-developer]",
      ctx(),
    );
    expect(effects).toEqual([{ kind: "openSkillsDialog", recommended: expect.arrayContaining(["researcher", "sw-developer"]) }]);
    expect(state.messages).toHaveLength(1);
    expect(state.messages[0].content).not.toContain("APP_IT_SKILLS_SET");
  });
});
