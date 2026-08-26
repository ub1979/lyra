export type GuidedRequirementsRoutingState = {
  completed: readonly string[];
  current: string | null;
};

/**
 * Per-turn guard for the guided coordinator.
 *
 * Requirements is a permanent team capability, not the speaker for every
 * message. The setup prompt establishes the long-lived rule; this short suffix
 * also repairs conversations that were created with the older, over-broad
 * "anything to build, change, or fix" instruction.
 */
export function guidedRequirementsTurnDirective({
  completed,
  current,
}: GuidedRequirementsRoutingState): string {
  if (completed.includes("req-engineer")) {
    return (
      "IDRAK_INTERNAL_REQUIREMENTS_ROUTING: Requirements are already approved. " +
      "Keep this turn with Lyra unless the user explicitly asks to revise requirements " +
      "or materially changes product scope, user-visible behavior, data, permissions, " +
      "integrations, or acceptance criteria. Status questions, explanations, approvals, " +
      "pause/stop commands, and ordinary in-scope feedback must not reactivate Requirements."
    );
  }

  if (current === "req-engineer") {
    return (
      "IDRAK_INTERNAL_REQUIREMENTS_ROUTING: A requirements interview is currently open. " +
      "Continue it only when this message answers or changes the active requirements. " +
      "If the user asks a status, explanation, pause/stop, or unrelated side question, " +
      "Lyra answers directly without reloading or restarting the Requirements playbook."
    );
  }

  return (
    "IDRAK_INTERNAL_REQUIREMENTS_ROUTING: Requirements is available but not automatically active. " +
    "Start it for the user's first meaningful product brief, an explicit requirements request, " +
    "or a material scope/behavior/data/permission/integration change. Do not start it for greetings, " +
    "status questions, explanations, approvals, pause/stop commands, or ordinary in-scope feedback. " +
    "If an existing requirements.md already covers the request, keep the turn with Lyra."
  );
}

export type GuidedUnavailableModelAssignment = {
  agentId: string;
  model: string;
};

/**
 * Exact model overrides are provider-specific. Report incompatible active
 * assignments so the UI can ask the user to choose replacements. It must not
 * guess a cross-provider equivalent or silently replace the user's choice.
 * An empty inventory is inconclusive for offline/custom providers.
 */
export function unavailableGuidedModelAssignments(
  assignments: Readonly<Record<string, string>>,
  activeAgentIds: readonly string[],
  availableModels: readonly string[],
): GuidedUnavailableModelAssignment[] {
  if (!availableModels.length) return [];

  const available = new Set(availableModels);
  const active = new Set(activeAgentIds);
  return Object.entries(assignments)
    .filter(([agentId, model]) => active.has(agentId) && !available.has(model))
    .map(([agentId, model]) => ({ agentId, model }));
}

export type GuidedApprovalChoice = "once" | "session" | "always" | "deny";

const ALL_APPROVAL_CHOICES: readonly GuidedApprovalChoice[] = [
  "once",
  "session",
  "always",
  "deny",
];

/** Match the Ink approval overlay's option order so numeric PTY input is safe. */
export function guidedApprovalChoices(payload: {
  allowPermanent?: boolean;
  choices?: readonly string[];
  smartDenied?: boolean;
}): GuidedApprovalChoice[] {
  if (payload.choices) {
    return payload.choices.filter((choice): choice is GuidedApprovalChoice =>
      ALL_APPROVAL_CHOICES.includes(choice as GuidedApprovalChoice),
    );
  }
  if (payload.smartDenied) return ["once", "deny"];
  return payload.allowPermanent === false
    ? ["once", "session", "deny"]
    : [...ALL_APPROVAL_CHOICES];
}

export function guidedApprovalKey(
  choices: readonly GuidedApprovalChoice[],
  choice: GuidedApprovalChoice,
): string | null {
  const index = choices.indexOf(choice);
  return index < 0 ? null : String(index + 1);
}
