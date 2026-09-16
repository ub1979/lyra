import { guidedApprovalChoices, guidedApprovalMessage } from "./guided-agent-routing";
import { updateGuidedWorkers, type GuidedRuntimeEventPayload } from "./guided-agent-runtime";
import { analyzeGuidedChatOutput, friendlyActivityLabel } from "./guided-chat-output";
import {
  appendMessageOnce,
  withActivity,
  working,
  type GuidedEventContext,
  type GuidedEventState,
  type GuidedRunningTool,
} from "./guided-event-state";
import { GUIDED_TOOL_SILENCE_GRACE_MS, extendGuidedSubagentGrace } from "./guided-turn-watchdog";

const ACTIVITY_EVENTS = new Set([
  "tool.start",
  "tool.progress",
  "tool.generating",
  "subagent.spawn_requested",
  "subagent.start",
  "subagent.thinking",
  "subagent.tool",
  "subagent.progress",
]);

type ToolPayload = GuidedRuntimeEventPayload & {
  allow_permanent?: unknown;
  args_text?: unknown;
  choices?: unknown;
  command?: unknown;
  context?: unknown;
  description?: unknown;
  name?: unknown;
  preview?: unknown;
  smart_denied?: unknown;
  tool_id?: unknown;
};

const text = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";

/** Tool, worker and approval events; returns null for anything else. */
export function reduceGuidedToolEvent(
  state: GuidedEventState,
  type: string,
  raw: unknown,
  ctx: GuidedEventContext,
): GuidedEventState | null {
  const payload = (raw && typeof raw === "object" ? raw : {}) as ToolPayload;
  if (ACTIVITY_EVENTS.has(type)) return activityEvent(state, type, payload, ctx);
  if (type === "subagent.complete") {
    return {
      ...state,
      lastSignalAt: ctx.now,
      subagentGraceUntil: 0,
      workers: updateGuidedWorkers(state.workers, type, payload, ctx.now),
    };
  }
  if (type === "tool.complete") return toolComplete(state, payload, ctx);
  if (type === "approval.request") return approvalRequest(state, payload, ctx);
  return null;
}

function activityEvent(
  state: GuidedEventState,
  type: string,
  payload: ToolPayload,
  ctx: GuidedEventContext,
): GuidedEventState {
  const signal = [
    payload.name,
    payload.args_text,
    payload.goal,
    payload.context,
    payload.preview,
    payload.summary,
    payload.text,
  ]
    .filter((value): value is string => typeof value === "string")
    .join(" ");
  const detected = analyzeGuidedChatOutput(signal).specialist;
  const selected =
    detected && ctx.selectedSpecialistIds.includes(detected.id) ? detected : null;
  const isSubagent = type.startsWith("subagent.");
  const label = friendlyActivityLabel(payload as Record<string, unknown>, isSubagent);

  let next: GuidedEventState = { ...state, turnSettled: false };
  if (isSubagent) {
    // Every genuine phase event pushes the deadline forward, so a live phase
    // is never interrupted — but silence after the last one is bounded.
    next = {
      ...next,
      subagentGraceUntil: extendGuidedSubagentGrace(state.subagentGraceUntil, type, ctx.now),
      workers: updateGuidedWorkers(state.workers, type, payload, ctx.now),
    };
  } else {
    next = { ...next, activeTools: trackTool(state.activeTools, type, payload, label, ctx.now) };
  }
  return withActivity(
    next,
    working(
      state,
      label ?? (isSubagent ? "An agent is working on this phase…" : "Preparing the next step…"),
      ctx.defaultSpecialist,
      selected,
    ),
    ctx.now,
  );
}

function trackTool(
  tools: ReadonlyMap<string, GuidedRunningTool>,
  type: string,
  payload: ToolPayload,
  label: string | null,
  now: number,
): ReadonlyMap<string, GuidedRunningTool> {
  const toolId = text(payload.tool_id);
  const next = new Map(tools);
  if (type === "tool.start") {
    const id = toolId || `${text(payload.name) || "tool"}-${now.toString(36)}`;
    next.set(id, {
      deadline: now + GUIDED_TOOL_SILENCE_GRACE_MS,
      id,
      label: label ?? "A project tool is running…",
      name: text(payload.name) || "tool",
      startedAt: now,
    });
    return next;
  }
  // A progress/generating event proves the active tool is alive. Extend the
  // matching id when supplied, otherwise every active call, because some
  // provider adapters emit id-less progress frames.
  for (const [id, tool] of next) {
    if (!toolId || id === toolId) {
      next.set(id, { ...tool, deadline: now + GUIDED_TOOL_SILENCE_GRACE_MS, label: label ?? tool.label });
    }
  }
  return next;
}

function toolComplete(
  state: GuidedEventState,
  payload: ToolPayload,
  ctx: GuidedEventContext,
): GuidedEventState {
  const next = new Map(state.activeTools);
  const toolId = text(payload.tool_id);
  if (toolId) {
    next.delete(toolId);
  } else if (typeof payload.name === "string") {
    for (const [id, tool] of next) if (tool.name === payload.name) next.delete(id);
  }
  const base = { ...state, activeTools: next, lastSignalAt: ctx.now };
  // Older backends confirm questions via tool completion; do not leave the
  // waiting label visible while the following model call runs.
  return payload.name === "clarify"
    ? { ...base, activity: { phase: "working", text: "Question handled. Continuing…", specialist: ctx.appItSpecialist } }
    : base;
}

function approvalRequest(
  state: GuidedEventState,
  payload: ToolPayload,
  ctx: GuidedEventContext,
): GuidedEventState {
  const choices = guidedApprovalChoices({
    allowPermanent: payload.allow_permanent === true,
    choices: Array.isArray(payload.choices)
      ? payload.choices.filter((c): c is string => typeof c === "string")
      : undefined,
    smartDenied: payload.smart_denied === true,
  });
  const command = text(payload.command);
  const description = text(payload.description) || "This action needs your approval";
  const fingerprint = JSON.stringify({ choices, command, description });
  const reuse = state.approval?.fingerprint === fingerprint ? state.approval : null;
  const approvalSeq = reuse ? state.approvalSeq : state.approvalSeq + 1;
  const messageId = reuse ? reuse.messageId : `approval-${ctx.now}-${approvalSeq}`;
  const approval = { choices, command, description, fingerprint, messageId };
  return withActivity(
    {
      ...state,
      approval,
      approvalSeq,
      messages: appendMessageOnce(state.messages, {
        id: messageId,
        role: "assistant",
        content: guidedApprovalMessage(description, choices, command),
        plain: true,
        createdAt: ctx.now,
      }),
    },
    working(state, "Waiting for your approval…", ctx.appItSpecialist),
    ctx.now,
  );
}
