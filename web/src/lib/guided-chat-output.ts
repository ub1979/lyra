const RESPONSE_MARKER =
  /^[\s┊┋│┃└┘├┤─━╰╯>*-]*Response[\s┊┋│┃└┘├┤─━╰╯]*$/i;

const TRANSCRIPT_CHROME =
  /^(?:[┊┋│┃└┘├┤─━╰╯\s]*)(?:Tool calls?(?:\s*\(\d+\))?|Thinking\b|Terminal\(|Skills List\(|Write File\(|Read File\(|Edit File\(|Apply Patch\(|Response\b)/i;

const DIFF_LINE =
  /^(?:a\/{1,2}|b\/{1,2}|@@|[+-](?:<!DOCTYPE|<|>|[.#:]|[A-Za-z_-]+\s*[:={([])|… omitted \d+ diff)/;

export type GuidedOutputPhase = "idle" | "working" | "response";

export interface GuidedSpecialist {
  id: string;
  label: string;
}

export interface GuidedChatPresentation {
  phase: GuidedOutputPhase;
  text: string;
  specialist: GuidedSpecialist | null;
}

const SPECIALISTS: Array<GuidedSpecialist & { patterns: RegExp }> = [
  { id: "req-engineer", label: "Requirements", patterns: /req-engineer|requirements?(?:\.md)?|acceptance criteria/i },
  { id: "spec", label: "Technical specification", patterns: /\bspec(?:ification)?\b|spec\.md/i },
  { id: "sw-architect", label: "Architecture", patterns: /sw-architect|architecture|system design|plan\.md/i },
  { id: "task-planner", label: "Task planning", patterns: /task-planner|task graph|task-graph\.md/i },
  { id: "proj-manager", label: "Project planning", patterns: /proj-manager|project plan|milestone/i },
  { id: "sw-developer", label: "Development", patterns: /sw-developer|develop(?:ment|er)|write file|edit file|apply patch|implement|coding/i },
  { id: "oop-restructurer", label: "Code restructuring", patterns: /oop-restructurer|restructur|refactor/i },
  { id: "debugger", label: "Debugging", patterns: /\bdebugg?(?:er|ing)?\b|root cause|regression/i },
  { id: "code-reviewer", label: "Code review", patterns: /code-reviewer|code review|review-report/i },
  { id: "qa-engineer", label: "Quality assurance", patterns: /qa-engineer|quality assurance|\bqa\b|smoke test|bug-report/i },
  { id: "security-auditor", label: "Security", patterns: /security-auditor|security audit|security-report/i },
  { id: "devops-engineer", label: "Deployment", patterns: /devops-engineer|deployment|deploy|ci\/cd|container/i },
  { id: "tech-writer", label: "Documentation", patterns: /tech-writer|documentation|readme\.md|docs\//i },
  { id: "benchmark", label: "Benchmarks", patterns: /benchmark|performance test/i },
  { id: "health", label: "Health checks", patterns: /health check|health-history/i },
  { id: "context-save", label: "Context preservation", patterns: /context-save|context preservation|context\.md/i },
  { id: "learn", label: "Controlled learning", patterns: /controlled learning|learning-candidates/i },
  { id: "idk-it", label: "Workflow coordination", patterns: /workflow coordination|coordinat(?:e|ing|ion)|delegate_task/i },
];

function detectSpecialist(raw: string): GuidedSpecialist | null {
  let latest: GuidedSpecialist | null = null;
  let latestIndex = -1;
  for (const specialist of SPECIALISTS) {
    const flags = specialist.patterns.flags.includes("g")
      ? specialist.patterns.flags
      : `${specialist.patterns.flags}g`;
    const pattern = new RegExp(specialist.patterns.source, flags);
    for (const match of raw.matchAll(pattern)) {
      if ((match.index ?? -1) > latestIndex) {
        latestIndex = match.index ?? -1;
        latest = { id: specialist.id, label: specialist.label };
      }
    }
  }
  return latest;
}

function cleanResponse(lines: string[]): string {
  const cleaned: string[] = [];
  let inDiff = false;

  for (const source of lines) {
    const undecorated = source
      .replace(/^[\s┊┋│┃]+/, "")
      .replace(/[\s┊┋│┃]+$/, "");
    const trimmed = undecorated.trim();
    if (/^[❯▸]\s*/.test(trimmed)) break;
    if (!trimmed) {
      if (cleaned.length && cleaned[cleaned.length - 1] !== "") cleaned.push("");
      continue;
    }
    if (
      TRANSCRIPT_CHROME.test(trimmed) ||
      /^[┊┋│┃└┘├┤─━╰╯\s]+$/.test(trimmed)
    ) {
      continue;
    }
    if (
      /^(?:a\/{1,2}.+→\s*b\/{1,2}|@@\s|… omitted \d+ diff)/.test(trimmed)
    ) {
      inDiff = true;
      continue;
    }
    if (inDiff && DIFF_LINE.test(trimmed)) continue;
    inDiff = false;

    cleaned.push(undecorated.trimEnd());
  }

  return cleaned.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * Turns the agent TUI transcript into a calm, user-facing chat message.
 * Tool calls, file diffs, paths, and internal reasoning stay in the terminal
 * buffer; guided mode exposes only the final response and a short live status.
 */
export function analyzeGuidedChatOutput(raw: string): GuidedChatPresentation {
  const lines = raw.replace(/\r/g, "").split("\n");
  let responseAt = -1;

  for (let index = 0; index < lines.length; index += 1) {
    if (RESPONSE_MARKER.test(lines[index].trim())) responseAt = index;
  }

  if (responseAt >= 0) {
    const response = cleanResponse(lines.slice(responseAt + 1));
    if (response) {
      return { phase: "response", text: response, specialist: null };
    }
  }

  const lower = raw.toLowerCase();
  const specialist = detectSpecialist(raw);
  if (
    /(?:verify|checking|test|lint|typecheck|build completed|openable)/.test(lower)
  ) {
    return {
      phase: "working",
      text: "I’m checking that everything works…",
      specialist: specialist ?? { id: "qa-engineer", label: "Quality assurance" },
    };
  }
  if (
    /(?:write file|edit file|apply patch|creating|implement|building|coding)/.test(
      lower,
    )
  ) {
    return {
      phase: "working",
      text: "I’m building your project…",
      specialist: specialist ?? { id: "sw-developer", label: "Development" },
    };
  }
  if (raw.trim()) {
    return { phase: "working", text: "Let me think…", specialist };
  }
  return { phase: "idle", text: "", specialist: null };
}

export function presentGuidedChatOutput(raw: string): string {
  return analyzeGuidedChatOutput(raw).text;
}
