export interface GuidedJobNotice {
  id: string;
  role: "assistant";
  content: string;
  plain: true;
  createdAt: number;
}

const JOB_NOTICE_KIND = "project_job";

/** A turn-free job update becomes one quiet chat line; every other status frame is not a message. */
export function guidedJobNotice(
  payload: unknown,
  now: number = Date.now(),
): GuidedJobNotice | null {
  if (!payload || typeof payload !== "object") return null;
  const frame = payload as Record<string, unknown>;
  if (frame.kind !== JOB_NOTICE_KIND) return null;
  const text = typeof frame.text === "string" ? frame.text.trim() : "";
  if (!text) return null;
  const identity = [frame.task_id, frame.event_kind, frame.event_cursor]
    .filter((part) => typeof part === "string" || typeof part === "number")
    .join(":");
  return {
    id: `job-notice-${identity || now}`,
    role: "assistant",
    content: text,
    plain: true,
    createdAt: now,
  };
}
