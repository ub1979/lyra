import { describe, expect, it } from "vitest";
import {
  GUIDED_MODEL_SILENCE_TIMEOUT_MS,
  GUIDED_SUBAGENT_SILENCE_GRACE_MS,
  GUIDED_SUBAGENT_SPAWN_GRACE_MS,
  GUIDED_TOOL_SILENCE_GRACE_MS,
  decideGuidedWatchdog,
  extendGuidedSubagentGrace,
  guidedSubagentGraceMs,
  guidedWatchdogMessage,
  isGuidedModelActivityEvent,
} from "./guided-turn-watchdog";

const NOW = 1_000_000;

describe("isGuidedModelActivityEvent", () => {
  it("counts provider wait heartbeats and reasoning as model activity", () => {
    expect(isGuidedModelActivityEvent("thinking.delta")).toBe(true);
    expect(isGuidedModelActivityEvent("reasoning.delta")).toBe(true);
  });

  it("does not mistake unrelated events for a model heartbeat", () => {
    expect(isGuidedModelActivityEvent("message.start")).toBe(false);
    expect(isGuidedModelActivityEvent("tool.progress")).toBe(false);
    expect(isGuidedModelActivityEvent("error")).toBe(false);
  });
});

describe("guidedSubagentGraceMs", () => {
  it("gives a running phase the long grace", () => {
    for (const type of [
      "subagent.start",
      "subagent.thinking",
      "subagent.tool",
      "subagent.progress",
    ]) {
      expect(guidedSubagentGraceMs(type)).toBe(
        GUIDED_SUBAGENT_SILENCE_GRACE_MS,
      );
    }
  });

  it("gives a mere spawn request a much shorter one", () => {
    expect(guidedSubagentGraceMs("subagent.spawn_requested")).toBe(
      GUIDED_SUBAGENT_SPAWN_GRACE_MS,
    );
    expect(GUIDED_SUBAGENT_SPAWN_GRACE_MS).toBeLessThan(
      GUIDED_SUBAGENT_SILENCE_GRACE_MS,
    );
  });

  it("gives non-subagent events nothing", () => {
    for (const type of [
      "tool.start",
      "tool.progress",
      "message.delta",
      "subagent.complete",
    ]) {
      expect(guidedSubagentGraceMs(type)).toBe(0);
    }
  });
});

describe("extendGuidedSubagentGrace", () => {
  it("opens a window on a spawn request", () => {
    expect(extendGuidedSubagentGrace(0, "subagent.spawn_requested", NOW)).toBe(
      NOW + GUIDED_SUBAGENT_SPAWN_GRACE_MS,
    );
  });

  it("pushes the window forward as a phase keeps reporting", () => {
    const first = extendGuidedSubagentGrace(0, "subagent.start", NOW);
    const later = extendGuidedSubagentGrace(
      first,
      "subagent.tool",
      NOW + 60_000,
    );
    expect(later).toBe(NOW + 60_000 + GUIDED_SUBAGENT_SILENCE_GRACE_MS);
    expect(later).toBeGreaterThan(first);
  });

  it("never shortens an earned window", () => {
    const running = extendGuidedSubagentGrace(0, "subagent.start", NOW);
    const afterSpawnRequest = extendGuidedSubagentGrace(
      running,
      "subagent.spawn_requested",
      NOW + 1_000,
    );
    expect(afterSpawnRequest).toBe(running);
  });

  it("leaves the window untouched for unrelated events", () => {
    expect(extendGuidedSubagentGrace(NOW + 500, "tool.progress", NOW)).toBe(
      NOW + 500,
    );
    expect(extendGuidedSubagentGrace(0, "message.delta", NOW)).toBe(0);
  });
});

describe("decideGuidedWatchdog", () => {
  it("stops the turn when no phase is running", () => {
    expect(decideGuidedWatchdog({ subagentGraceUntil: 0, now: NOW })).toEqual({
      action: "stop",
      reason: "model",
    });
  });

  it("does not classify a running ordinary tool as model silence", () => {
    const toolGraceUntil = NOW + GUIDED_TOOL_SILENCE_GRACE_MS;
    expect(
      decideGuidedWatchdog({
        subagentGraceUntil: 0,
        toolGraceUntil,
        now: NOW + GUIDED_MODEL_SILENCE_TIMEOUT_MS,
      }),
    ).toEqual({ action: "extend" });
  });

  it("stops a tool with an accurate reason after its backend-sized grace", () => {
    const toolGraceUntil = NOW + GUIDED_TOOL_SILENCE_GRACE_MS;
    expect(
      decideGuidedWatchdog({
        subagentGraceUntil: 0,
        toolGraceUntil,
        now: toolGraceUntil,
      }),
    ).toEqual({ action: "stop", reason: "tool" });
  });

  it("uses the later deadline when a subagent and tool overlap", () => {
    expect(
      decideGuidedWatchdog({
        subagentGraceUntil: NOW + 60_000,
        toolGraceUntil: NOW + 120_000,
        now: NOW + 60_000,
      }),
    ).toEqual({ action: "extend" });
  });

  it("extends while a phase is inside its window", () => {
    expect(
      decideGuidedWatchdog({ subagentGraceUntil: NOW + 1, now: NOW }),
    ).toEqual({ action: "extend" });
  });

  it("stops once the window has expired instead of extending forever", () => {
    // The 42-minute hang: a spawn was requested, nothing followed, and the old
    // code re-armed the timer on every tick because a flag was still set.
    expect(decideGuidedWatchdog({ subagentGraceUntil: NOW, now: NOW })).toEqual(
      {
        action: "stop",
        reason: "subagent",
      },
    );
    expect(
      decideGuidedWatchdog({ subagentGraceUntil: NOW - 1, now: NOW }),
    ).toEqual({
      action: "stop",
      reason: "subagent",
    });
  });

  it("bounds a spawn request that never becomes a subagent", () => {
    const graceUntil = extendGuidedSubagentGrace(
      0,
      "subagent.spawn_requested",
      NOW,
    );
    expect(
      decideGuidedWatchdog({
        subagentGraceUntil: graceUntil,
        now: NOW + GUIDED_SUBAGENT_SPAWN_GRACE_MS - 1,
      }),
    ).toEqual({ action: "extend" });
    expect(
      decideGuidedWatchdog({
        subagentGraceUntil: graceUntil,
        now: NOW + GUIDED_SUBAGENT_SPAWN_GRACE_MS,
      }),
    ).toEqual({ action: "stop", reason: "subagent" });
  });

  it("never interrupts a phase that keeps reporting in", () => {
    let graceUntil = 0;
    let now = NOW;
    for (let tick = 0; tick < 40; tick += 1) {
      graceUntil = extendGuidedSubagentGrace(
        graceUntil,
        "subagent.progress",
        now,
      );
      now += 60_000;
      expect(
        decideGuidedWatchdog({ subagentGraceUntil: graceUntil, now }),
      ).toEqual({ action: "extend" });
    }
    // ...but silence after the last report is still bounded.
    now += GUIDED_SUBAGENT_SILENCE_GRACE_MS;
    expect(
      decideGuidedWatchdog({ subagentGraceUntil: graceUntil, now }),
    ).toEqual({
      action: "stop",
      reason: "subagent",
    });
  });
});

describe("guidedWatchdogMessage", () => {
  it("names the specialist phase when that is what stalled", () => {
    expect(guidedWatchdogMessage("subagent")).toMatch(/project agent/i);
    expect(guidedWatchdogMessage("subagent")).toMatch(/2 minutes/);
  });

  it("names the model when it never answered", () => {
    expect(GUIDED_MODEL_SILENCE_TIMEOUT_MS).toBeGreaterThan(120_000);
    expect(guidedWatchdogMessage("model")).toMatch(/about 2 minutes/);
  });

  it("names a stalled tool without blaming the model", () => {
    expect(guidedWatchdogMessage("tool")).toMatch(/project tool/i);
    expect(guidedWatchdogMessage("tool")).toMatch(/model itself was responding/i);
  });
});
