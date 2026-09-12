export type GuidedRequirementsRoutingState = {
  completed: readonly string[];
  current: string | null;
};

/**
 * Per-turn communication guard for both new and already-saved project chats.
 *
 * Saved conversations retain their original cached setup message, so changing
 * the project skill alone cannot repair their user-facing vocabulary. This
 * compact suffix applies the current product language without mutating history.
 */
export function guidedPlainLanguageTurnDirective(): string {
  return (
    "IDRAK_INTERNAL_PLAIN_LANGUAGE: Speak for a non-technical user. " +
    "Do not show roadmap or change-request codes, migrations, schemas, filenames, " +
    "raw test counts, or engineering gate jargon unless the user asks for technical details. " +
    "Translate progress into what now works. Explicitly say whether the whole application " +
    "is finished, what remains, and whether anything is blocked or partially implemented. " +
    "A completed task or milestone does not mean the whole application is finished."
  );
}

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

/**
 * Keep the foreground Studio conversation as the responsive coordinator.
 *
 * This is sent with every turn because an existing conversation can retain an
 * older cached coordinator prompt. It changes only the new user message and
 * therefore does not rewrite history or invalidate the cached prefix.
 */
export function guidedProjectExecutionTurnDirective(
  approvedAgentIds: readonly string[],
): string {
  return (
    `IDRAK_INTERNAL_PROJECT_EXECUTION: ${JSON.stringify({
      approved_agents: approvedAgentIds,
    })}. ` +
    "Classify this user message before using tools. Answer status questions, explanations, " +
    "approvals, and pause or stop requests directly as Lyra. For a concrete report of wrong " +
    "behavior, first compare it with the latest approved requirements. If it is covered, the " +
    "first owner is Debugging, which reproduces the exact report and establishes the root cause; " +
    "then Development implements the bounded fix; finally QA independently reruns the exact " +
    "user-reported journey and relevant regression checks. If the expected behavior is genuinely " +
    "new or unclear in the approved requirements, Requirements asks one focused delta question " +
    "before downstream work. Every non-interactive phase must be queued with hermes project-run " +
    "as a durable background project job. In this foreground conversation, do not load specialist " +
    "playbooks, do not edit application files, do not run application test suites, and do not " +
    "perform a specialist's work. Lyra may inspect concise project-run status and queue or resume " +
    "the bounded job. After the queue accepts it, immediately tell the user which agent owns it, " +
    "what it is checking, whether the whole application is finished, and that work continues in " +
    "the background, then end this turn. Use only approved_agents. If a required agent is absent, " +
    "ask to add it; never silently activate it or do its work in the main chat."
  );
}

export type GuidedProjectTurnRoutingState = GuidedRequirementsRoutingState & {
  approvedAgentIds: readonly string[];
  includeRequirements?: boolean;
  models: Readonly<Record<string, string>>;
  provider: string;
};

/** Compose every live guard together so send and retry paths cannot diverge. */
export function guidedProjectTurnDirectives({
  approvedAgentIds,
  completed,
  current,
  includeRequirements = true,
  models,
  provider,
}: GuidedProjectTurnRoutingState): string[] {
  const directives = [
    guidedPlainLanguageTurnDirective(),
    guidedModelRoutingTurnDirective(provider, models),
    guidedProjectExecutionTurnDirective(approvedAgentIds),
  ];
  if (includeRequirements) {
    directives.push(guidedRequirementsTurnDirective({ completed, current }));
  }
  return directives;
}

/** Keep automatic handoffs interactive only for the Requirements interview. */
export function guidedPhaseContinuationDirective(
  phaseId: string | null,
  phaseLabel: string | null,
): string {
  if (phaseId === "req-engineer") {
    return `IDRAK_INTERNAL_CONTINUE: Start the interactive ${phaseLabel ?? "Requirements"} phase now in this conversation, emit [APP_IT_PHASE:${phaseId}], and stop at its approval checkpoint. Requirements is the only interactive specialist phase.`;
  }
  if (phaseId) {
    return `IDRAK_INTERNAL_CONTINUE: Start the ${phaseLabel ?? phaseId} phase by inspecting project-run status and queueing ${phaseId} as a durable background project job. Do not load its playbook or perform its work in this conversation. Emit [APP_IT_PHASE:${phaseId}] when the job is confirmed, immediately acknowledge the handoff to the user, and end this foreground turn. The background completion notification will resume the workflow.`;
  }
  return "IDRAK_INTERNAL_CONTINUE: Inspect project-run status and queue or resume the next approved non-interactive phase as a durable background project job. Do not load a specialist playbook or perform specialist work in this conversation. Immediately acknowledge the confirmed handoff and end this foreground turn. Stop instead for an interactive Requirements or approval checkpoint, a real user decision, permission request, blocker, or final completion.";
}

/** Override any provider/model map frozen in an older conversation prefix. */
export function guidedModelRoutingTurnDirective(
  provider: string,
  models: Readonly<Record<string, string>>,
): string {
  const owner = provider.trim();
  const providers = Object.fromEntries(
    Object.entries(models)
      .filter(([, model]) => Boolean(model.trim()) && Boolean(owner))
      .map(([agentId]) => [agentId, owner]),
  );
  return `IDRAK_INTERNAL_MODEL_ROUTING: ${JSON.stringify({
    provider: owner,
    specialist_models: models,
    specialist_providers: providers,
  })}. This current project routing replaces every earlier model assignment. A missing specialist model means Follow project model. Always pass the matching provider with an explicit specialist model.`;
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
    const offered = payload.choices.filter((choice): choice is GuidedApprovalChoice =>
      ALL_APPROVAL_CHOICES.includes(choice as GuidedApprovalChoice),
    );
    if (offered.length) return offered;
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

const APPROVAL_LABELS: Record<GuidedApprovalChoice, string> = {
  once: "Allow once",
  session: "Allow this session",
  always: "Always allow",
  deny: "Deny",
};

export function guidedApprovalLabel(choice: GuidedApprovalChoice): string {
  return APPROVAL_LABELS[choice];
}

/** Put the complete approval request in the transcript, not in a second panel. */
export function guidedApprovalMessage(
  description: string,
  choices: readonly GuidedApprovalChoice[],
  command = "",
): string {
  const options = choices.map(guidedApprovalLabel).join(", ");
  return [
    description.trim() || "This action needs your approval.",
    command.trim() ? `Action: ${command.trim()}` : "",
    `Type your choice below: ${options}.`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** Resolve only explicit typed approval answers; unrelated chat must not approve. */
export function guidedApprovalChoiceFromText(
  choices: readonly GuidedApprovalChoice[],
  input: string,
): GuidedApprovalChoice | null {
  const normalized = input.trim().toLocaleLowerCase().replace(/[.!]+$/g, "").trim();
  const aliases: Record<GuidedApprovalChoice, readonly string[]> = {
    once: ["allow once", "once", "approve once", "yes", "approve", "allow"],
    session: ["allow this session", "this session", "session"],
    always: ["always allow", "allow always", "always"],
    deny: ["deny", "do not allow", "don't allow", "reject", "no"],
  };
  const numeric = Number(normalized);
  if (Number.isInteger(numeric) && numeric >= 1 && numeric <= choices.length) {
    return choices[numeric - 1] ?? null;
  }
  return choices.find(choice => aliases[choice].includes(normalized)) ?? null;
}
