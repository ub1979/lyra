export type GuidedTeamSelectionMode = "manual" | "guided";

export const guidedTeamSelectionKey = (workspace: string) =>
  `idrak-it.guided-team-selection.v1:${workspace}`;

export function saveGuidedTeamSelection(storage: Pick<Storage, "setItem">, workspace: string, mode: GuidedTeamSelectionMode): void {
  try { storage.setItem(guidedTeamSelectionKey(workspace), mode); } catch { /* Live selection remains valid. */ }
}

export function readGuidedTeamSelection(storage: Pick<Storage, "getItem" | "setItem">, workspace: string, seed: string | null): GuidedTeamSelectionMode {
  try {
    const match = seed?.match(/IDRAK_INTERNAL_SETUP_BEGIN\s+(.+?)\s+IDRAK_INTERNAL_SETUP_END/);
    const mode = match ? JSON.parse(match[1]).team_selection_mode : null;
    if (mode === "guided" || mode === "manual") {
      saveGuidedTeamSelection(storage, workspace, mode);
      return mode;
    }
    return storage.getItem(guidedTeamSelectionKey(workspace)) === "guided" ? "guided" : "manual";
  } catch { return "manual"; }
}

export function guidedTeamSelectionDirective(mode: GuidedTeamSelectionMode): string {
  return "IDRAK_INTERNAL_TEAM_SELECTION: " + (mode === "guided"
    ? "The user chose Let Lyra guide me. Recommend the smallest useful team within their selected build profile. A proposal is not approval; wait for dashboard confirmation before using added agents."
    : "The user has chosen and approved the project team. Follow the selected agents and models. Do not recommend another team, emit APP_IT_SKILLS_SET, reopen team selection, or ask them to approve the same team again. If the selected team cannot perform a requested task, explain that concrete limitation without changing the team; wait for the user to change their selection.");
}
