export interface GuidedUsageSnapshot {
  cacheRead: number;
  cacheWrite: number;
  calls: number;
  contextMax: number;
  contextUsed: number;
  costUsd: number;
  input: number;
  model: string;
  output: number;
  reasoning: number;
}

export interface GuidedWorkerRuntime extends GuidedUsageSnapshot {
  goal: string;
  id: string;
  label: string;
  lastActivity: string;
  lastSignalAt: number;
  startedAt: number;
  status: "running" | "stopping" | "completed" | "failed" | "interrupted";
  toolCount: number;
}

export interface GuidedRuntimeEventPayload {
  api_calls?: unknown;
  cache_read_tokens?: unknown;
  cache_write_tokens?: unknown;
  cost_usd?: unknown;
  display_label?: unknown;
  duration_seconds?: unknown;
  goal?: unknown;
  input_tokens?: unknown;
  model?: unknown;
  output_tokens?: unknown;
  reasoning_tokens?: unknown;
  status?: unknown;
  subagent_id?: unknown;
  summary?: unknown;
  task_index?: unknown;
  text?: unknown;
  tool_count?: unknown;
  tool_name?: unknown;
}

const numberValue = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) ? value : 0;

const stringValue = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";

export const EMPTY_GUIDED_USAGE: GuidedUsageSnapshot = {
  cacheRead: 0,
  cacheWrite: 0,
  calls: 0,
  contextMax: 0,
  contextUsed: 0,
  costUsd: 0,
  input: 0,
  model: "",
  output: 0,
  reasoning: 0,
};

export function normalizeGuidedUsage(value: unknown): GuidedUsageSnapshot {
  if (!value || typeof value !== "object") return EMPTY_GUIDED_USAGE;
  const usage = value as Record<string, unknown>;
  return {
    cacheRead: numberValue(usage.cache_read),
    cacheWrite: numberValue(usage.cache_write),
    calls: numberValue(usage.calls),
    contextMax: numberValue(usage.context_max),
    contextUsed: numberValue(usage.context_used),
    costUsd: numberValue(usage.cost_usd),
    input: numberValue(usage.input),
    model: stringValue(usage.model),
    output: numberValue(usage.output),
    reasoning: numberValue(usage.reasoning),
  };
}

export function updateGuidedWorkers(
  current: readonly GuidedWorkerRuntime[],
  type: string,
  payload: GuidedRuntimeEventPayload,
  now: number,
): GuidedWorkerRuntime[] {
  const rawId = stringValue(payload.subagent_id);
  const taskIndex = numberValue(payload.task_index);
  const id = rawId || `worker-${taskIndex}`;
  if (!type.startsWith("subagent.") || (!rawId && payload.task_index == null)) {
    return [...current];
  }

  const previous = current.find((worker) => worker.id === id);
  const reportedStatus = stringValue(payload.status);
  const status: GuidedWorkerRuntime["status"] =
    type === "subagent.complete"
      ? reportedStatus === "failed"
        ? "failed"
        : reportedStatus === "interrupted"
          ? "interrupted"
          : "completed"
      : previous?.status === "stopping"
        ? "stopping"
        : "running";
  const lastActivity =
    stringValue(payload.text) ||
    stringValue(payload.summary) ||
    stringValue(payload.tool_name) ||
    previous?.lastActivity ||
    "Working";
  const next: GuidedWorkerRuntime = {
    cacheRead:
      numberValue(payload.cache_read_tokens) || previous?.cacheRead || 0,
    cacheWrite:
      numberValue(payload.cache_write_tokens) || previous?.cacheWrite || 0,
    calls: numberValue(payload.api_calls) || previous?.calls || 0,
    contextMax: 0,
    contextUsed: 0,
    costUsd: numberValue(payload.cost_usd) || previous?.costUsd || 0,
    goal:
      stringValue(payload.goal) || previous?.goal || "Delegated project work",
    id,
    input: numberValue(payload.input_tokens) || previous?.input || 0,
    label:
      stringValue(payload.display_label) ||
      previous?.label ||
      `Agent ${taskIndex + 1}`,
    lastActivity,
    lastSignalAt: now,
    model: stringValue(payload.model) || previous?.model || "Project default",
    output: numberValue(payload.output_tokens) || previous?.output || 0,
    reasoning:
      numberValue(payload.reasoning_tokens) || previous?.reasoning || 0,
    startedAt:
      previous?.startedAt ||
      Math.max(0, now - numberValue(payload.duration_seconds) * 1000),
    status,
    toolCount: numberValue(payload.tool_count) || previous?.toolCount || 0,
  };

  return [...current.filter((worker) => worker.id !== id), next]
    .sort((a, b) => b.startedAt - a.startedAt)
    .slice(0, 12);
}

export function markGuidedWorkerStopping(
  current: readonly GuidedWorkerRuntime[],
  id?: string,
): GuidedWorkerRuntime[] {
  return current.map((worker) =>
    (id ? worker.id === id : worker.status === "running")
      ? { ...worker, status: "stopping" }
      : worker,
  );
}

export function formatGuidedTokens(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0";
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 1 : 2)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(value >= 100_000 ? 0 : 1)}K`;
  }
  return Math.round(value).toLocaleString();
}

export function guidedUsageTotal(usage: GuidedUsageSnapshot): number {
  return usage.input + usage.cacheRead + usage.output + usage.reasoning;
}
