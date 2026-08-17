/**
 * Specialists the project cannot switch off.
 *
 * Requirements is one of them. Lyra used to gather requirements herself with a
 * few orienting questions and delegate to `req-engineer` only when the request
 * looked "unclear" — so a request that merely *sounded* clear went straight to
 * planning or code with no interview, no Grill, no design-space exploration and
 * no `requirements.md`. That is the expensive kind of miss: the build is wrong
 * before the first line is written.
 *
 * Pinning it here closes the loophole on the dashboard side. The team can be
 * set from three directions — the `?builder=` URL, the specialists dialog, and
 * Lyra's own `[APP_IT_SKILLS_SET:...]` marker — and every one of them funnels
 * through `applyGuidedSpecialistIds`, so pinning at that funnel means no path
 * can produce a project without Requirements. The matching instruction-side
 * gate lives in the app-it and ultimate-app-builder playbooks.
 */

/** Ids that are always part of the team, in the order they should lead. */
export const GUIDED_REQUIRED_SPECIALIST_IDS: readonly string[] = ["req-engineer"];

export function isRequiredGuidedSpecialist(id: string): boolean {
  return GUIDED_REQUIRED_SPECIALIST_IDS.includes(id);
}

/**
 * Normalise a proposed team: drop unknown ids, de-duplicate, and guarantee the
 * required specialists are present, listed first so downstream prompts and
 * labels lead with them.
 *
 * A required id is only added when *allowed* recognises it, so a build that
 * renames or retires the playbook degrades to "not pinned" instead of sending
 * the agent a specialist that no longer exists.
 */
export function withRequiredGuidedSpecialists(
  ids: readonly string[],
  allowed: readonly string[],
): string[] {
  const known = new Set(allowed);
  const required = GUIDED_REQUIRED_SPECIALIST_IDS.filter((id) => known.has(id));
  const rest = ids.filter(
    (id) => known.has(id) && !required.includes(id),
  );
  return Array.from(new Set([...required, ...rest]));
}
