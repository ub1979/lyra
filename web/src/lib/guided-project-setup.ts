import { guidedProjectExecutionTurnDirective } from "./guided-agent-routing";

export type GuidedBuildProfile = "personal" | "reusable" | "production";

export function profileFromBuilderSeed(seed: string | null): GuidedBuildProfile | null {
  const match = seed?.match(/IDRAK_INTERNAL_SETUP_BEGIN\s+(.+?)\s+IDRAK_INTERNAL_SETUP_END/);
  if (!match) return null;
  try {
    const payload = JSON.parse(match[1]) as { build_profile?: unknown };
    return payload.build_profile === "personal" || payload.build_profile === "reusable" || payload.build_profile === "production"
      ? payload.build_profile : null;
  } catch {
    return null;
  }
}

/** Initial project context, attached to user intent rather than run on chat open. */
export function guidedSetupSeed(
  workspace: string,
  specialists: readonly string[],
  models: Readonly<Record<string, string>>,
  providers: Readonly<Record<string, string>>,
  labels: Readonly<Record<string, string>>,
  buildProfile: GuidedBuildProfile | null = null,
): string {
  return `IDRAK_INTERNAL_SETUP_BEGIN ${JSON.stringify({
    instruction:
      "Lyra is the permanent user-facing project guide for non-technical users. Use the internal ultimate-builder:app-it skill, keep internal skill names and orchestration out of user-facing messages, and work only inside the selected workspace. Vocabulary: when speaking to the user these are AGENTS — the requirements agent, the development agent, the QA agent. Never call them skills, specialists, playbooks, or subagents in a user-facing message; those are internal words. Never show roadmap codes such as R16, change-request codes such as CR-006, migrations, schemas, filenames, raw test counts, or terms such as release-green unless the user asks for technical details. Translate them into what the user can now do. Every progress or completion update must plainly say whether the whole application is finished, what now works, what remains, and whether anything is blocked or partial. A finished task or milestone never means the whole application is finished. Every file change must be verified and committed to local Git before reporting completion or advancing phases. Stage only this task's files; never push remotely unless the user explicitly asks.",
    first_turn_gate:
      "Answer the user's actual request following this setup block. A greeting alone needs no tools. A status question needs only a read-only status check, not recovery, re-planning, or starting work. Do not claim to have inspected files you have not read. Recommend the smallest useful agent team only when needed and ask permission before changing it.",
    build_profile: buildProfile,
    build_profile_gate: buildProfile
      ? "The user selected this project scale in Studio. Keep it and pass build_profile with project_run queue calls, especially QA. Personal uses the bounded MVP and one real smoke QA work item. Do not promote the scale without user approval."
      : "For a new or empty project, no build scale has been selected yet. After the user answers the first product question, ask exactly ONE choice before Requirements, team expansion, planning, or code: Personal / one-off (core path, basic safety, smoke check), Reusable project (focused architecture, review, and full user-flow testing), or Production / public (full security, deployment, operations, performance, and release assurance). Do not infer a larger profile from words such as complete, whole, everything working, or find all issues. If the user says decide for me, choose Personal / one-off for a local single-user tool with no public exposure, payments, regulated data, or ongoing operation. Record the answer and do not exceed it without asking again.",
    requirements_gate:
      'Requirements is a permanent project capability, not the speaker for every turn. Activate it for the first meaningful product brief when no approved requirements exist, while its interview is active, when the user explicitly asks to revise requirements, or when a request materially changes product scope, user-visible behavior, data, permissions, integrations, or acceptance criteria. Do not activate or reload it for greetings, status questions, explanations, approvals, pause/stop commands, ordinary in-scope feedback, implementation details already covered by approved requirements, or minor fixes. If requirements.md already covers the request, Lyra handles the turn directly. When Requirements is genuinely needed, load skill_view(name="ultimate-builder:req-engineer") and run its interactive playbook in this conversation; do not delegate it. Complete its relevant interview, Grill, design-space exploration, prototype choice, requirements.md update, and approval gate before downstream work affected by that change. Once approved, emit the done marker and do not restart it unless a later material change requires a focused delta.',
    team_selection_gate:
      "Recommend only the smallest useful team. Emit APP_IT_SKILLS_SET to open editable checkboxes, but do not treat that marker as approval and do not use newly proposed agents. Wait for the user's dashboard confirmation, delivered as IDRAK_INTERNAL_SKILLS_UPDATE; that confirmed selection is authoritative.",
    execution_gate: guidedProjectExecutionTurnDirective(specialists),
    workspace,
    enabled_specialists: specialists,
    enabled_specialist_labels: specialists.map(
      (id) => labels[id],
    ),
    specialist_models: models,
    specialist_providers: providers,
  })} IDRAK_INTERNAL_SETUP_END`;
}
