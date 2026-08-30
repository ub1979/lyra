import { api } from "@/lib/api";

/**
 * Lyra's own version, for the sidebar badge.
 *
 * Kept apart from `StatusResponse.version`, which reports the upstream Hermes
 * CLI the product is built on. Two different numbers answering two different
 * questions: the footer used to show the CLI's, so "which version are you on?"
 * had no answer a user could give.
 */

export interface LyraUpdateStatus {
  /** Commits behind the tracked remote branch, or null when unknown. */
  behind: number | null;
  update_available: boolean;
  branch: string | null;
  /** False when git, the remote, or the count was unavailable. */
  checked: boolean;
}

export interface LyraVersion {
  version: string | null;
  channel: string | null;
  /** Ready to print: "beta v0.19.16". */
  display: string | null;
  release_name: string | null;
  released: string | null;
  title: string | null;
  notes: string[];
  update: LyraUpdateStatus;
}

export async function fetchLyraVersion(force = false): Promise<LyraVersion> {
  return api.getLyraVersion(force);
}

/**
 * What the footer prints.
 *
 * Never falls back to the upstream Hermes CLI version: two numbers in one slot
 * is what made "which version are you on?" unanswerable. If Lyra's version
 * cannot be read, the footer says so instead of showing a number that belongs
 * to something else.
 */
export function versionLabel(lyra: LyraVersion | null): string {
  return lyra?.display ?? "—";
}

/**
 * Hover text for the badge: the release, and the update state in plain words.
 *
 * An unknown update state says so rather than implying "up to date" — silence
 * about an unchecked thing is how people end up running six-week-old builds
 * believing they are current.
 */
export function versionTooltip(lyra: LyraVersion | null): string {
  if (!lyra?.version) return "Version unavailable";

  const parts: string[] = [];
  const title = lyra.title || lyra.release_name;
  parts.push(title ? `${lyra.display} — ${title}` : String(lyra.display));
  if (lyra.released) parts.push(`Released ${lyra.released}`);

  const { behind, branch, checked, update_available } = lyra.update;
  if (!checked) {
    parts.push("Update state unknown (no git remote to compare against)");
  } else if (update_available && behind) {
    const commits = behind === 1 ? "1 commit" : `${behind} commits`;
    parts.push(`Update available — ${commits} behind ${branch ?? "the remote"}`);
  } else {
    parts.push("Up to date");
  }
  return parts.join(" · ");
}

/** True when the footer should show the "update available" dot. */
export function shouldShowUpdateDot(lyra: LyraVersion | null): boolean {
  return Boolean(lyra?.update.checked && lyra.update.update_available);
}
