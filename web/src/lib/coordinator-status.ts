import type { PtyConnectionState } from "./pty-reconnect";

export interface CoordinatorStatus {
  connection: PtyConnectionState;
  eventsConnected: boolean;
  working: boolean;
}

/** Transport state outranks the last activity snapshot after a disconnect. */
export function coordinatorStatusLabel(state: CoordinatorStatus): string {
  if (state.connection === "closed" || state.connection === "ended") return "Lyra disconnected";
  if (state.connection === "connecting") return "Lyra connecting";
  if (state.connection === "reconnecting" || !state.eventsConnected) return "Lyra reconnecting";
  return state.working ? "Lyra working" : "Lyra ready";
}
