/**
 * The phase chain: who is working now, what is done, what runs next.
 *
 * Before this existed the dashboard inferred all of that from prose. The only
 * control marker in the protocol was `[APP_IT_SKILLS_SET:...]` for the team, so
 * the active specialist was guessed by regex over output text — `sw-developer`
 * matched "write file", Lyra matched the word "lyra" anywhere — and advancement
 * depended on `guidedResponseNeedsContinuation()` spotting a phrase like
 * "delegating to the architect". A phase that ended with "next I'll bring in
 * the architect" matched nothing, so the chain stopped and Lyra waited for the
 * user. And a phase Lyra runs in the conversation herself (requirements, which
 * must be interactive) never produced subagent events at all, so it always
 * showed as Lyra.
 *
 * Lyra now states it instead: `[APP_IT_PHASE:<id>]` when a phase takes over and
 * `[APP_IT_PHASE_DONE:<id>]` when its artifact is verified. Both are stripped
 * from the visible reply, exactly like the team marker.
 */

/**
 * Canonical order of the delivery chain. Ids not listed here (health,
 * context-save, learn, …) keep their relative order after the known ones, so a
 * new specialist does not silently vanish from the strip.
 */
export const GUIDED_PHASE_ORDER: readonly string[] = [
  "req-engineer",
  "spec",
  "sw-architect",
  "task-planner",
  "proj-manager",
  "sw-developer",
  "oop-restructurer",
  "debugger",
  "code-reviewer",
  "qa-engineer",
  "security-auditor",
  "devops-engineer",
  "benchmark",
  "tech-writer",
  "health",
  "context-save",
  "learn",
];

const PHASE_START = /\[APP_IT_PHASE:([^\]]*)\]/gi;
const PHASE_DONE = /\[APP_IT_PHASE_DONE:([^\]]*)\]/gi;

/** Put an enabled team into delivery order. */
export function orderGuidedPhases(enabled: readonly string[]): string[] {
  const known = GUIDED_PHASE_ORDER.filter((id) => enabled.includes(id));
  const unknown = enabled.filter((id) => !GUIDED_PHASE_ORDER.includes(id));
  return [...known, ...unknown];
}

export type GuidedPhaseMarkers = {
  /** The reply with every phase marker removed. */
  content: string;
  /** Phases that announced they are taking over, in order of appearance. */
  started: string[];
  /** Phases that announced a verified artifact. */
  completed: string[];
};

/**
 * Pull the phase markers out of a reply.
 *
 * DONE is matched first: `[APP_IT_PHASE_DONE:x]` also contains the literal
 * `[APP_IT_PHASE:` prefix, so scanning for starts first would read every
 * completion as a start too.
 */
export function parseGuidedPhaseMarkers(
  raw: string,
  allowed: readonly string[],
): GuidedPhaseMarkers {
  const known = new Set(allowed);
  const collect = (pattern: RegExp, text: string): string[] => {
    const found: string[] = [];
    for (const match of text.matchAll(pattern)) {
      const id = match[1].trim().toLowerCase().replace(/^ultimate-builder:/, "");
      if (known.has(id) && !found.includes(id)) found.push(id);
    }
    return found;
  };

  const completed = collect(PHASE_DONE, raw);
  const withoutDone = raw.replace(PHASE_DONE, "");
  const started = collect(PHASE_START, withoutDone);

  return {
    completed,
    content: withoutDone.replace(PHASE_START, "").trim(),
    started,
  };
}

/**
 * The phase that should run next, or null when the chain is finished.
 *
 * `current` still counts as outstanding: a phase that started but has not
 * reported an artifact is not skipped over.
 */
export function nextGuidedPhase({
  completed,
  current,
  ordered,
}: {
  completed: readonly string[];
  current: string | null;
  ordered: readonly string[];
}): string | null {
  const done = new Set(completed);
  if (current && !done.has(current)) return current;
  return ordered.find((id) => !done.has(id)) ?? null;
}

export type GuidedPhaseState = "done" | "now" | "pending";

export type GuidedPhaseStep = {
  id: string;
  state: GuidedPhaseState;
};

/** Render model for the progress strip. */
export function guidedPhaseProgress({
  completed,
  current,
  ordered,
}: {
  completed: readonly string[];
  current: string | null;
  ordered: readonly string[];
}): GuidedPhaseStep[] {
  const done = new Set(completed);
  return ordered.map((id) => ({
    id,
    state: done.has(id) ? "done" : id === current ? "now" : "pending",
  }));
}

/**
 * True when the reply is waiting on the user and must not be auto-advanced.
 *
 * The approval gates the playbooks define (requirements sign-off, visual
 * preview, final delivery) plus anything that reads like a question, a blocker,
 * or a permission request. Auto-advancing past these is what turns a guided
 * build into an unsupervised one.
 */
export function guidedPhaseAwaitsUser(raw: string): boolean {
  const text = raw.trim();
  if (!text) return false;
  return (
    /[?？]\s*$/.test(text) ||
    /\b(approve|approval|confirm|sign off|sign-off)\b/i.test(text) ||
    /\b(blocked|blocker|cannot proceed|permission|which would you|shall i|may i|let me know)\b/i.test(
      text,
    ) ||
    /\b(preview ready|does this look|ready for (?:your )?review)\b/i.test(text)
  );
}

/**
 * Should the dashboard nudge the next phase after this reply?
 *
 * Deliberately conservative: an explicit completion marker, a next phase to run,
 * and nothing in the reply that asks the user something.
 */
export function shouldAdvanceGuidedPhase({
  completedInReply,
  next,
  reply,
}: {
  completedInReply: readonly string[];
  next: string | null;
  reply: string;
}): boolean {
  if (!completedInReply.length || !next) return false;
  if (completedInReply.includes(next)) return false;
  return !guidedPhaseAwaitsUser(reply);
}
