import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { GatewayEvent } from "@hermes/shared";

import { reduceGuidedEvent } from "./guided-event-reducer";
import { INITIAL_GUIDED_STATE, type GuidedEventContext, type GuidedEventState } from "./guided-event-state";

// Real frames captured by tests/tui_gateway/test_lyra_project_workflow.py from
// the actual gateway. Python produces, TypeScript consumes; the file between
// them is the reviewed contract. Regenerate with LYRA_WRITE_FRAME_FIXTURES=1.
const FIXTURES = resolve(__dirname, "../../../tests/fixtures/studio_frames");

function frames(name: string): GatewayEvent[] {
  return readFileSync(resolve(FIXTURES, `${name}.jsonl`), "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as GatewayEvent);
}

function replay(name: string, start: GuidedEventState = INITIAL_GUIDED_STATE) {
  let counter = 0;
  const ctx: GuidedEventContext = {
    agentName: (id, label) => label ?? id,
    appItSpecialist: { id: "app-it", label: "Lyra" },
    clarificationPending: false,
    defaultSpecialist: { id: "app-it", label: "Lyra" },
    labelFor: () => undefined,
    newId: (prefix) => `${prefix}-${++counter}`,
    now: 1_000,
    selectableSpecialistIds: ["researcher", "sw-architect"],
    selectedSpecialistIds: ["researcher", "sw-architect"],
  };
  let state = start;
  const effects = [];
  for (const event of frames(name)) {
    const step = reduceGuidedEvent(state, event, ctx);
    state = step.state;
    effects.push(...step.effects);
  }
  return { effects, state };
}

describe("real gateway frames replayed through the reducer", () => {
  it("notification-after-reply: two turns leave two visible replies", () => {
    const { effects, state } = replay("notification-after-reply");
    const replies = state.messages.filter((m) => m.role === "assistant" && !m.plain);
    expect(replies).toHaveLength(2);
    expect(replies[0].content).toContain("research is finished");
    expect(replies[1].content).toContain("completion notice");
    expect(new Set(replies.map((m) => m.turn)).size).toBe(2);
    expect(state.activity.phase).toBe("idle");
    expect(state.turnSettled).toBe(true);
    expect(state.usage.reported).toBe(true);
    expect(effects.filter((e) => e.kind === "agentReady")).toHaveLength(2);
  });

  it("timed-out-notice: one quiet line, no turn, no change to activity", () => {
    const before = { ...INITIAL_GUIDED_STATE, turnSeq: 3 };
    const { effects, state } = replay("timed-out-notice", before);
    const plain = state.messages.filter((m) => m.plain);
    expect(plain).toHaveLength(1);
    expect(plain[0].content).toContain("attempt failed");
    expect(state.messages.filter((m) => !m.plain)).toHaveLength(0);
    expect(state.turnSeq).toBe(3);
    expect(state.activity).toEqual(before.activity);
    expect(effects).toEqual([]);
  });
});
