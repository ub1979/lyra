/**
 * Silence watchdog for a guided-chat turn.
 *
 * A turn is stopped when the agent goes quiet for
 * {@link GUIDED_MODEL_SILENCE_TIMEOUT_MS}. Specialist (subagent) phases
 * legitimately outlast a single model reply, so they get an extension — but a
 * *bounded* one.
 *
 * The bug this replaces: the watchdog was skipped outright while an
 * "active subagent" flag was set, and that flag was set by
 * `subagent.spawn_requested` — a spawn *request*, not a running subagent. It
 * was cleared only by `subagent.complete`, `message.complete` or `error`, so a
 * spawn that never started, or a subagent that died without reporting, left the
 * watchdog resetting its own clock every 75 seconds. Forever. The turn showed
 * "Taking longer than usual" with a climbing counter and no way out — observed
 * at 42 minutes.
 *
 * Now every real subagent event pushes a deadline forward, so a live phase is
 * never interrupted, while a silent one dies a bounded time after its last
 * genuine signal.
 */

/** No signal at all from the model for this long → stop the turn. */
export const GUIDED_MODEL_SILENCE_TIMEOUT_MS = 75_000;

/** A running specialist phase may stay silent this long before it is stopped. */
export const GUIDED_SUBAGENT_SILENCE_GRACE_MS = 120_000;

/**
 * A spawn *request* is not a running subagent: if nothing follows it, the
 * spawn never happened. Much shorter leash than a phase that has reported in.
 */
export const GUIDED_SUBAGENT_SPAWN_GRACE_MS = 90_000;

/**
 * Events that prove a specialist phase is genuinely running, as opposed to
 * merely requested.
 */
const GUIDED_SUBAGENT_LIVE_EVENTS = new Set([
  "subagent.start",
  "subagent.thinking",
  "subagent.tool",
  "subagent.progress",
]);

const GUIDED_SUBAGENT_SPAWN_EVENT = "subagent.spawn_requested";

/** Grace an event buys, or 0 for events that are not subagent activity. */
export function guidedSubagentGraceMs(eventType: string): number {
  if (eventType === GUIDED_SUBAGENT_SPAWN_EVENT) {
    return GUIDED_SUBAGENT_SPAWN_GRACE_MS;
  }
  return GUIDED_SUBAGENT_LIVE_EVENTS.has(eventType)
    ? GUIDED_SUBAGENT_SILENCE_GRACE_MS
    : 0;
}

/**
 * Fold an event into the current deadline (epoch ms; 0 = no phase running).
 *
 * Monotonic: a late `spawn_requested` for a second phase cannot shorten the
 * deadline a already-running phase earned.
 */
export function extendGuidedSubagentGrace(
  current: number,
  eventType: string,
  now: number,
): number {
  const grace = guidedSubagentGraceMs(eventType);
  return grace === 0 ? current : Math.max(current, now + grace);
}

export type GuidedWatchdogDecision =
  | { action: "extend" }
  | { action: "stop"; reason: "model" | "subagent" };

/**
 * Decide what to do once the silence timer has elapsed.
 *
 * - inside a phase's grace window → extend (the phase is still allowed time)
 * - grace window expired → stop, and say it was the specialist that stalled
 * - no phase at all → stop, the model never answered
 */
export function decideGuidedWatchdog({
  subagentGraceUntil,
  now,
}: {
  subagentGraceUntil: number;
  now: number;
}): GuidedWatchdogDecision {
  if (subagentGraceUntil > 0) {
    if (now < subagentGraceUntil) return { action: "extend" };
    return { action: "stop", reason: "subagent" };
  }
  return { action: "stop", reason: "model" };
}

/** User-facing explanation for a stopped turn. */
export function guidedWatchdogMessage(reason: "model" | "subagent"): string {
  if (reason === "subagent") {
    return (
      "A project agent stopped reporting progress for over " +
      `${Math.round(GUIDED_SUBAGENT_SILENCE_GRACE_MS / 60_000)} minutes. ` +
      "The worker was stopped; Lyra is still available. Check the model or retry the task."
    );
  }
  return (
    "Lyra did not receive a response from the AI model within " +
    `${Math.round(GUIDED_MODEL_SILENCE_TIMEOUT_MS / 1000)} seconds. ` +
    "The turn was stopped; check the AI model or select Stop & retry."
  );
}
