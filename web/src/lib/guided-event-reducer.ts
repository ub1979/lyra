import type { GatewayEvent } from "@hermes/shared";

import { normalizeGuidedUsage } from "./guided-agent-runtime";
import {
  extractAppItSkillSelection,
  sanitizeGuidedResponse,
  shouldAutoContinueGuidedWorkflow,
} from "./guided-chat-output";
import {
  IDLE_ACTIVITY,
  appendErrorMessage,
  appendMessageOnce,
  unchanged,
  withActivity,
  working,
  type GuidedEffect,
  type GuidedEventContext,
  type GuidedEventState,
  type GuidedReduction,
} from "./guided-event-state";
import { guidedJobNotice } from "./guided-job-notice";
import {
  nextGuidedPhase,
  orderGuidedPhases,
  parseGuidedPhaseMarkers,
  shouldAdvanceGuidedPhase,
} from "./guided-phase-plan";
import { guidedReplyWarning } from "./guided-reply-warning";
import { withRequiredGuidedSpecialists } from "./guided-required-specialists";
import { mergeGuidedResponse } from "./guided-response-merge";
import { reduceGuidedToolEvent } from "./guided-tool-events";
import {
  guidedCompressionTransition,
  isGuidedModelActivityEvent,
  shouldRestoreGuidedWorkingState,
} from "./guided-turn-watchdog";

export const MAX_AUTO_CONTINUES = 24;

type Payload = Record<string, unknown>;

const payloadOf = (event: GatewayEvent): Payload =>
  event.payload && typeof event.payload === "object" ? (event.payload as Payload) : {};

/**
 * Fold one gateway event into the Studio conversation state.
 *
 * Pure: the same state and event always give the same result, and every
 * clock or id comes from `ctx`. Anything that must touch the outside world
 * (persisting a session id, sending the next prompt) is returned as an effect
 * for ChatPage to run. `clarify.*` events are owned by useGuidedClarification
 * and are not handled here.
 */
export function reduceGuidedEvent(
  state: GuidedEventState,
  event: GatewayEvent,
  ctx: GuidedEventContext,
): GuidedReduction {
  const type = String(event.type);
  const payload = payloadOf(event);

  if (type === "status.update") return statusUpdate(state, payload, ctx);
  if (type === "session.info") return sessionInfo(state, payload, ctx);
  if (type === "message.start") {
    return unchanged(
      withActivity(
        { ...state, streamedText: "", turnSeq: state.turnSeq + 1, turnSettled: false },
        working(state, "Continuing with the next step…", ctx.defaultSpecialist),
        ctx.now,
      ),
    );
  }
  if (type === "message.delta") {
    const text = typeof payload.text === "string" ? payload.text : "";
    return unchanged({ ...state, lastSignalAt: ctx.now, streamedText: state.streamedText + text });
  }
  if (type === "thinking.delta" || type === "reasoning.delta") {
    let next = state;
    if (isGuidedModelActivityEvent(type, payload)) next = { ...next, lastSignalAt: ctx.now };
    const waitText = type === "thinking.delta" && typeof payload.text === "string" ? payload.text.trim() : "";
    if (waitText) next = { ...next, activity: working(state, waitText, ctx.defaultSpecialist) };
    return unchanged(next);
  }
  if (type === "message.complete") return messageComplete(state, payload, ctx);
  if (type === "error") {
    const message = typeof payload.message === "string" ? payload.message : "";
    if (!message) return unchanged(state);
    return unchanged({
      ...appendErrorMessage(state, message, ctx),
      activeTools: new Map(),
      activity: IDLE_ACTIVITY,
      approval: null,
      subagentGraceUntil: 0,
      turnSettled: true,
    });
  }
  const tooled = reduceGuidedToolEvent(state, type, event.payload, ctx);
  return unchanged(tooled ?? state);
}

function statusUpdate(state: GuidedEventState, payload: Payload, ctx: GuidedEventContext): GuidedReduction {
  const notice = guidedJobNotice(payload, ctx.now);
  if (notice) {
    // A saved job's retry or stale update: one quiet line, no turn, and no
    // change to what Lyra is doing right now.
    return unchanged({ ...state, messages: appendMessageOnce(state.messages, notice) });
  }
  const transition = guidedCompressionTransition("status.update", payload.kind);
  if (transition === "start") {
    return unchanged(
      withActivity(
        { ...state, compacting: true, turnSettled: false },
        working(state, "Summarizing the conversation so Lyra can continue…", ctx.defaultSpecialist),
        ctx.now,
      ),
    );
  }
  if (transition === "finish") {
    return unchanged(
      withActivity(
        { ...state, compacting: false },
        working(state, "Conversation summarized. Continuing…", ctx.defaultSpecialist),
        ctx.now,
      ),
    );
  }
  return unchanged(state);
}

function sessionInfo(state: GuidedEventState, payload: Payload, ctx: GuidedEventContext): GuidedReduction {
  const effects: GuidedEffect[] = [{ kind: "agentReady" }];
  const storedSessionId = typeof payload.stored_session_id === "string" ? payload.stored_session_id.trim() : "";
  if (storedSessionId) effects.push({ kind: "persistSessionId", sessionId: storedSessionId });
  let next = state;
  if (payload.usage) next = { ...next, usage: normalizeGuidedUsage(payload.usage, ctx.now) };
  if (
    shouldRestoreGuidedWorkingState({
      backendRunning: payload.running,
      browserPhase: state.activity.phase,
      waitingForInput: ctx.clarificationPending || state.approval !== null,
    })
  ) {
    next = withActivity(
      { ...next, turnSettled: false },
      { phase: "working", text: "Lyra is continuing the active request…", specialist: ctx.defaultSpecialist },
      ctx.now,
    );
  }
  return { effects, state: next };
}

function messageComplete(state: GuidedEventState, payload: Payload, ctx: GuidedEventContext): GuidedReduction {
  // A completed parent message is a definitive boundary for any child phase,
  // even when a provider omitted subagent.complete.
  let next: GuidedEventState = {
    ...state,
    activeTools: new Map(),
    approval: null,
    compacting: false,
    streamedText: "",
    subagentGraceUntil: 0,
  };
  if (payload.usage) next = { ...next, usage: normalizeGuidedUsage(payload.usage, ctx.now) };
  const response = (
    typeof payload.text === "string" && payload.text.trim() ? payload.text : state.streamedText
  ).trim();

  if (!response) {
    const failure = typeof payload.failure_reason === "string" ? payload.failure_reason : "";
    if (failure) next = appendErrorMessage(next, `The AI model could not finish this response: ${failure}`, ctx);
    return unchanged({ ...next, activity: IDLE_ACTIVITY, turnSettled: true });
  }

  const teamRecommendation = extractAppItSkillSelection(response, ctx.selectableSpecialistIds);
  const finished = applyGuidedResponse(next, response, ctx);
  next = finished.state;
  // The gateway's "shown but not saved" word rides on the same frame; it must
  // be seen, not dropped, and must never overwrite or be overwritten by a reply.
  const warning = guidedReplyWarning(payload, state.turnSeq, ctx.now);
  if (warning) next = { ...next, messages: appendMessageOnce(next.messages, warning) };
  const effects = [...finished.effects];
  const advanceTo = next.phaseAdvance;
  next = { ...next, phaseAdvance: null };

  if (
    shouldAutoContinueGuidedWorkflow({
      awaitingTeamConfirmation: Boolean(teamRecommendation),
      hasDeclaredNextPhase: Boolean(advanceTo),
      response,
    })
  ) {
    const attempt = next.autoContinueCount + 1;
    next = { ...next, autoContinueCount: attempt };
    if (attempt > MAX_AUTO_CONTINUES) {
      return {
        effects,
        state: appendErrorMessage(
          next,
          "The workflow paused after too many automatic handoffs. Send “continue” to resume from the current phase.",
          ctx,
        ),
      };
    }
    const label = advanceTo ? (ctx.labelFor(advanceTo) ?? advanceTo) : null;
    next = withActivity(
      { ...next, turnSettled: false },
      {
        phase: "working",
        text: advanceTo ? `Handing over to ${ctx.agentName(advanceTo, label ?? undefined)}…` : "Moving to the promised agent…",
        specialist: advanceTo
          ? { id: advanceTo, label: label ?? advanceTo }
          : (state.activity.specialist ?? ctx.defaultSpecialist),
      },
      ctx.now,
    );
    effects.push({ kind: "autoContinue", phase: advanceTo, label });
  }
  return { effects, state: next };
}

/**
 * The reply pipeline: phase markers first (they decide who is working and what
 * runs next), then the team recommendation (a proposal, never permission),
 * then the visible text, which refines only its own turn's earlier reply.
 */
export function applyGuidedResponse(
  state: GuidedEventState,
  content: string,
  ctx: GuidedEventContext,
): GuidedReduction {
  const effects: GuidedEffect[] = [];
  const phases = parseGuidedPhaseMarkers(content, ctx.selectableSpecialistIds);
  const startedPhase = phases.started[phases.started.length - 1] ?? null;
  let phasesCompleted = state.phasesCompleted;
  if (phases.completed.length) {
    phasesCompleted = Array.from(new Set([...state.phasesCompleted, ...phases.completed]));
  }
  let phaseCurrent = state.phaseCurrent;
  if (startedPhase) phaseCurrent = startedPhase;
  else if (phaseCurrent && phases.completed.includes(phaseCurrent)) phaseCurrent = null;

  const skillSelection = extractAppItSkillSelection(phases.content, ctx.selectableSpecialistIds);
  if (skillSelection) {
    effects.push({
      kind: "openSkillsDialog",
      recommended: withRequiredGuidedSpecialists(skillSelection.skillIds, ctx.selectableSpecialistIds),
    });
  }
  const response = sanitizeGuidedResponse(skillSelection?.content ?? phases.content);
  let next: GuidedEventState = { ...state, phaseCurrent, phasesCompleted };
  if (!response || response === state.lastResponse) return { effects, state: next };

  const upcoming = nextGuidedPhase({
    completed: phasesCompleted,
    current: phaseCurrent,
    ordered: orderGuidedPhases(ctx.selectedSpecialistIds),
  });
  const phaseAdvance = shouldAdvanceGuidedPhase({
    completedInReply: phases.completed,
    next: upcoming,
    reply: response,
    startedInReply: phases.started,
  })
    ? upcoming
    : null;
  next = {
    ...next,
    activity: IDLE_ACTIVITY,
    lastResponse: response,
    lastSignalAt: ctx.now,
    messages: mergeGuidedResponse(state.messages, response, state.turnSeq, ctx.now, ctx.newId("assistant")),
    output: response,
    phaseAdvance,
    turnSettled: true,
  };
  return { effects, state: next };
}
