import type { GuidedApprovalChoice } from "./guided-agent-routing";
import {
  EMPTY_GUIDED_USAGE,
  type GuidedUsageSnapshot,
  type GuidedWorkerRuntime,
} from "./guided-agent-runtime";
import type { GuidedChatPresentation, GuidedSpecialist } from "./guided-chat-output";
import type { GuidedMergeMessage } from "./guided-response-merge";

/** One line of the Studio transcript as the browser stores it. */
export interface GuidedMessage extends GuidedMergeMessage {
  role: "user" | "assistant" | "error";
}

export interface GuidedRunningTool {
  deadline: number;
  id: string;
  label: string;
  name: string;
  startedAt: number;
}

export interface GuidedApprovalRequest {
  choices: GuidedApprovalChoice[];
  command: string;
  description: string;
  fingerprint: string;
  messageId: string;
}

/**
 * Everything a gateway event may change. Each field mirrors a `useState`
 * slice or a ref that ChatPage keeps today; the reducer owns the transitions,
 * ChatPage owns rendering and I/O.
 */
export interface GuidedEventState {
  activeTools: ReadonlyMap<string, GuidedRunningTool>;
  activity: GuidedChatPresentation;
  approval: GuidedApprovalRequest | null;
  approvalSeq: number;
  autoContinueCount: number;
  compacting: boolean;
  lastResponse: string;
  lastSignalAt: number;
  messages: readonly GuidedMessage[];
  output: string;
  phaseAdvance: string | null;
  phaseCurrent: string | null;
  phasesCompleted: readonly string[];
  streamedText: string;
  subagentGraceUntil: number;
  turnSeq: number;
  turnSettled: boolean;
  usage: GuidedUsageSnapshot;
  workers: readonly GuidedWorkerRuntime[];
}

export const IDLE_ACTIVITY: GuidedChatPresentation = {
  phase: "idle",
  text: "",
  specialist: null,
};

export const INITIAL_GUIDED_STATE: GuidedEventState = {
  activeTools: new Map(),
  activity: IDLE_ACTIVITY,
  approval: null,
  approvalSeq: 0,
  autoContinueCount: 0,
  compacting: false,
  lastResponse: "",
  lastSignalAt: 0,
  messages: [],
  output: "",
  phaseAdvance: null,
  phaseCurrent: null,
  phasesCompleted: [],
  streamedText: "",
  subagentGraceUntil: 0,
  turnSeq: 0,
  turnSettled: true,
  usage: EMPTY_GUIDED_USAGE,
  workers: [],
};

/** Read-only facts the reducer needs but does not own; every impurity is injected here. */
export interface GuidedEventContext {
  /** Lyra herself, the specialist shown for questions and approvals. */
  appItSpecialist: GuidedSpecialist;
  /** True while a clarification question is open (owned by useGuidedClarification). */
  clarificationPending: boolean;
  defaultSpecialist: GuidedSpecialist | null;
  agentName: (id: string, label?: string) => string;
  labelFor: (id: string) => string | undefined;
  newId: (prefix: string) => string;
  now: number;
  selectableSpecialistIds: readonly string[];
  selectedSpecialistIds: readonly string[];
}

/** Decisions the reducer cannot carry out itself; ChatPage runs them. */
export type GuidedEffect =
  | { kind: "agentReady" }
  | { kind: "persistSessionId"; sessionId: string }
  | { kind: "openSkillsDialog"; recommended: string[] }
  | { kind: "autoContinue"; phase: string | null; label: string | null };

export interface GuidedReduction {
  effects: GuidedEffect[];
  state: GuidedEventState;
}

export const unchanged = (state: GuidedEventState): GuidedReduction => ({
  effects: [],
  state,
});

export function withActivity(
  state: GuidedEventState,
  activity: GuidedChatPresentation,
  now: number,
): GuidedEventState {
  return { ...state, activity, lastSignalAt: now };
}

/** A working label that keeps the current specialist unless one is supplied. */
export function working(
  state: GuidedEventState,
  text: string,
  fallback: GuidedSpecialist | null,
  specialist?: GuidedSpecialist | null,
): GuidedChatPresentation {
  return {
    phase: "working",
    text,
    specialist: specialist ?? state.activity.specialist ?? fallback,
  };
}

export function appendMessageOnce(
  messages: readonly GuidedMessage[],
  message: GuidedMessage,
): readonly GuidedMessage[] {
  return messages.some((existing) => existing.id === message.id)
    ? messages
    : [...messages, message];
}

/** An error line is appended once; an identical trailing error is not repeated. */
export function appendErrorMessage(
  state: GuidedEventState,
  content: string,
  ctx: Pick<GuidedEventContext, "newId" | "now">,
): GuidedEventState {
  const last = state.messages[state.messages.length - 1];
  if (last?.role === "error" && last.content === content) return state;
  return {
    ...state,
    messages: [
      ...state.messages,
      { id: ctx.newId("error"), role: "error", content, createdAt: ctx.now },
    ],
  };
}
