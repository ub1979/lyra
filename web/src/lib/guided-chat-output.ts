const RESPONSE_MARKER =
  /^[\s┊┋│┃└┘├┤─━╰╯>*-]*Response[\s┊┋│┃└┘├┤─━╰╯]*$/i;

const TRANSCRIPT_CHROME =
  /^(?:[┊┋│┃└┘├┤─━╰╯\s]*)(?:Tool calls?(?:\s*\(\d+\))?|Thinking\b|Terminal\(|Skills List\(|Write File\(|Read File\(|Edit File\(|Apply Patch\(|Response\b)/i;

const DIFF_LINE =
  /^(?:a\/{1,2}|b\/{1,2}|@@|[+-](?:<!DOCTYPE|<|>|[.#:]|[A-Za-z_-]+\s*[:={([])|… omitted \d+ diff)/;

const INLINE_REASONING_BLOCK =
  /\s*[├└]─\s*▾\s*Thinking\b[\s\S]*?[├└]─\s*Σ\s*~?[\d,.]+\s*total\b/gi;

const INLINE_TOOL_BLOCK =
  /\s*[├└]─\s*▾\s*Tool calls?(?:\s*\(\d+\))?[\s\S]*?(?=[├└]─\s*Response\b|$)/gi;

const APP_IT_SKILLS_SET = /\[APP_IT_SKILLS_SET:([^\]]*)\]/i;

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
  { id: "app-it", label: "Lyra", patterns: /ultimate-builder:app-it|\bapp it\b|\blyra\b|project coordinator/i },
  { id: "req-engineer", label: "Requirements", patterns: /req-engineer|requirements\.md|acceptance criteria/i },
  { id: "researcher", label: "Research", patterns: /ultimate-builder:researcher|research-report\.md|source verification/i },
  { id: "spec", label: "Technical specification", patterns: /ultimate-builder:spec|\bspec\.md\b/i },
  { id: "sw-architect", label: "Architecture", patterns: /sw-architect|plan\.md|system design/i },
  { id: "task-planner", label: "Task planning", patterns: /task-planner|task planning playbook|task-graph\.md/i },
  { id: "proj-manager", label: "Project planning", patterns: /proj-manager|project-plan\.md/i },
  { id: "sw-developer", label: "Development", patterns: /sw-developer|write file|edit file|apply patch/i },
  { id: "oop-restructurer", label: "Code restructuring", patterns: /oop-restructurer|restructur|refactor/i },
  { id: "debugger", label: "Debugging", patterns: /ultimate-builder:debugger|root-cause evidence|regression test/i },
  { id: "code-reviewer", label: "Code review", patterns: /code-reviewer|code review|review-report/i },
  { id: "qa-engineer", label: "Quality assurance", patterns: /qa-engineer|quality assurance|\bqa\b|smoke test|bug-report/i },
  { id: "security-auditor", label: "Security", patterns: /security-auditor|security audit|security-report/i },
  { id: "devops-engineer", label: "Deployment", patterns: /devops-engineer|deployment|deploy|ci\/cd|container/i },
  { id: "tech-writer", label: "Documentation", patterns: /tech-writer|readme\.md|docs\//i },
  { id: "benchmark", label: "Benchmarks", patterns: /benchmark|performance test/i },
  { id: "health", label: "Health checks", patterns: /health check|health-history/i },
  { id: "context-save", label: "Context preservation", patterns: /context-save|context preservation|context\.md/i },
  { id: "learn", label: "Controlled learning", patterns: /controlled learning|learning-candidates/i },
  { id: "idk_it", label: "Workflow coordination", patterns: /workflow coordination|delegate_task/i },
];

const SPECIALIST_ROLE_PATTERNS: Array<{
  specialist: GuidedSpecialist;
  pattern: RegExp;
}> = [
  { specialist: { id: "app-it", label: "Lyra" }, pattern: /\byou are (?:the )?(?:app it|lyra)\b/i },
  { specialist: { id: "req-engineer", label: "Requirements" }, pattern: /\byou are (?:the )?requirements? engineer\b/i },
  { specialist: { id: "researcher", label: "Research" }, pattern: /\byou are (?:the )?(?:web |internet )?research(?:er| agent)\b/i },
  { specialist: { id: "spec", label: "Technical specification" }, pattern: /\byou are (?:the )?(?:technical )?specification (?:engineer|specialist)\b/i },
  { specialist: { id: "sw-architect", label: "Architecture" }, pattern: /\byou are (?:the )?(?:software |system )?architect\b/i },
  { specialist: { id: "task-planner", label: "Task planning" }, pattern: /\byou are (?:the )?task planner\b/i },
  { specialist: { id: "proj-manager", label: "Project planning" }, pattern: /\byou are (?:the )?project manager\b/i },
  { specialist: { id: "sw-developer", label: "Development" }, pattern: /\byou are (?:the )?(?:software )?developer\b/i },
  { specialist: { id: "qa-engineer", label: "Quality assurance" }, pattern: /\byou are (?:the )?(?:qa|quality assurance) engineer\b/i },
  { specialist: { id: "tech-writer", label: "Documentation" }, pattern: /\byou are (?:the )?technical writer\b/i },
];

export interface AppItSkillSelection {
  content: string;
  skillIds: string[];
}

/**
 * App IT emits this control marker only after the user approves a proposed
 * team. Guided chat consumes it as project state and never shows it as prose.
 */
export function extractAppItSkillSelection(
  raw: string,
  allowedIds: readonly string[],
): AppItSkillSelection | null {
  const match = raw.match(APP_IT_SKILLS_SET);
  if (!match) return null;
  const allowed = new Set(allowedIds);
  const skillIds = Array.from(
    new Set(
      match[1]
        .split(",")
        .map((value) => {
          const token = value.trim().toLowerCase();
          const withoutPrefix = token.replace(/^ultimate-builder:/, "");
          return SPECIALISTS.find(
            (specialist) =>
              specialist.id === withoutPrefix ||
              specialist.label.toLowerCase() === withoutPrefix,
          )?.id;
        })
        .filter(
          (id): id is string => typeof id === "string" && allowed.has(id),
        ),
    ),
  );
  return {
    content: raw.replace(APP_IT_SKILLS_SET, "").trim(),
    skillIds,
  };
}

function detectSpecialist(raw: string): GuidedSpecialist | null {
  for (const candidate of SPECIALIST_ROLE_PATTERNS) {
    if (candidate.pattern.test(raw)) return candidate.specialist;
  }
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
 * Removes internal TUI reasoning and tool transcript blocks that a provider
 * may fold into the final text payload. Guided chat must never expose these
 * implementation details, even when the structured event feed carries them.
 */
export function sanitizeGuidedResponse(raw: string): string {
  const withoutInlineBlocks = raw
    .replace(/\r/g, "")
    .replace(APP_IT_SKILLS_SET, " ")
    .replace(INLINE_REASONING_BLOCK, " ")
    .replace(INLINE_TOOL_BLOCK, " ")
    .replace(/[├└]─\s*Response\b/gi, " ");

  const cleaned = cleanResponse(withoutInlineBlocks.split("\n"))
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+([,.;:!?])/g, "$1")
    .trim();

  // Guided conversations deliberately ask one question at a time. Providers
  // sometimes obey the "one question mark" constraint while appending a
  // second, unpunctuated decision after it. Showing only the first complete
  // question makes the browser contract deterministic instead of relying on
  // prompt compliance alone. The next decision can arrive after the answer.
  const firstQuestionEnd = cleaned.search(/[?？]/);
  // Limit this guard to concise conversational turns. Requirements summaries,
  // reports, code, and documentation may legitimately contain question marks
  // and must never be truncated.
  if (
    firstQuestionEnd < 0 ||
    cleaned.length > 1_200 ||
    cleaned.includes("\n")
  ) {
    return cleaned;
  }
  const markdownClosers =
    cleaned
      .slice(firstQuestionEnd + 1)
      .match(/^(?:[*_~`]+|[\])}"'’”»])+/)?.[0] ?? "";
  return (
    cleaned.slice(0, firstQuestionEnd + 1) + markdownClosers
  ).trim();
}

/**
 * Some providers narrate a phase handoff ("delegating now") and then stop the
 * turn before issuing the promised tool call. Guided mode can safely nudge
 * those transitional replies, but never cross an explicit approval/question
 * gate on the user's behalf.
 */
export function guidedResponseNeedsContinuation(raw: string): boolean {
  const text = sanitizeGuidedResponse(raw);
  if (!text || /[?？]|\bapprov(?:e|al)\b|\bpreview ready\b|\bdoes this look\b/i.test(text)) return false;
  return (
    /\b(?:delegat(?:e|ing)|hand(?:ing)? off)\b[\s\S]{0,180}\b(?:specialist|subagent|agent|phase|plan\.md|task-graph\.md)\b/i.test(
      text,
    ) ||
    /\b(?:playbook|specialist)\b[\s\S]{0,100}\bloaded\b[\s\S]{0,160}\b(?:next|now|delegat|proceed)/i.test(
      text,
    ) ||
    /\b(?:i(?:'ll| will) (?:continue|pick up)|continue automatically)\b[\s\S]{0,160}\b(?:when|once|after)\b/i.test(
      text,
    )
  );
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
    /(?:write file|edit file|apply patch|creating (?:a |the )?file|implementing|building (?:the |your )?project)/.test(
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

const FRIENDLY_TOOL_LABELS: Record<string, string> = {
  Write: "Writing",
  Edit: "Editing",
  Read: "Reading",
  Bash: "Running a command",
  Terminal: "Running a command",
  WebSearch: "Searching the web",
  web_search: "Searching the web",
  web_extract: "Fetching a web page",
  WebFetch: "Fetching a web page",
  Apply: "Applying changes",
  "Apply Patch": "Applying changes",
  "Write File": "Writing",
  "Edit File": "Editing",
  "Read File": "Reading",
  Grep: "Searching code",
  GlobTool: "Finding files",
  Agent: "Delegating to a specialist",
};

/**
 * Derives a short, user-friendly activity label from a structured event payload.
 * Returns `null` when no useful label can be derived — the caller falls back to
 * a generic phrase.
 *
 * Status labels are capped at 80 characters, contain no newlines, and never
 * expose raw file contents or full paths — only the basename.
 *
 * Text addressed to the *user* is exempt from that cap. A `clarify` call is the
 * agent asking a question, and the activity indicator is where the user reads it
 * while the turn is still running; cutting it at 80 characters left them staring
 * at half a sentence with no way to see the rest ("…whenever the legal-safety or
 * pla…"). Those are returned whole, on one line, and the bubble grows to fit.
 */
export function friendlyActivityLabel(
  payload: Record<string, unknown> | null | undefined,
  isSubagent: boolean,
): string | null {
  if (!payload) return null;

  if (isSubagent) {
    const goal = typeof payload.goal === "string" ? payload.goal.trim() : "";
    const summary = typeof payload.summary === "string" ? payload.summary.trim() : "";
    const toolPreview = typeof payload.tool_preview === "string" ? payload.tool_preview.trim() : "";
    const toolName = typeof payload.tool_name === "string" ? payload.tool_name.trim() : "";

    if (summary) {
      return _isUserFacing(toolName, summary) ? _whole(summary) : _cap(summary);
    }
    if (toolName && toolPreview) {
      const verb = FRIENDLY_TOOL_LABELS[toolName] ?? toolName;
      return _cap(`${verb}: ${_basename(toolPreview)}`);
    }
    if (toolName) {
      const verb = FRIENDLY_TOOL_LABELS[toolName];
      return verb ? _cap(verb) : null;
    }
    if (goal) return _cap(goal);
    return null;
  }

  const context = typeof payload.context === "string" ? payload.context.trim() : "";
  const name = typeof payload.name === "string" ? payload.name.trim() : "";
  const preview = typeof payload.preview === "string" ? payload.preview.trim() : "";
  const summary = typeof payload.summary === "string" ? payload.summary.trim() : "";

  if (context) {
    const shortened = _shortenPaths(context);
    return _isUserFacing(name, shortened) ? _whole(shortened) : _cap(shortened);
  }
  if (summary) {
    return _isUserFacing(name, summary) ? _whole(summary) : _cap(summary);
  }

  const verb = name ? (FRIENDLY_TOOL_LABELS[name] ?? name) : "";
  if (verb && preview) return _cap(`${verb}: ${_basename(preview)}`);
  if (verb) return _cap(verb);
  return null;
}

function _shortenPaths(text: string): string {
  return text.replace(/(?:\/[A-Za-z][A-Za-z0-9._-]*){3,}/g, (match) => {
    const parts = match.split("/").filter(Boolean);
    return parts.length > 2
      ? parts.slice(-2).join("/")
      : parts.join("/");
  });
}

function _basename(text: string): string {
  const clean = text.replace(/\n[\s\S]*/, "").trim();
  const match = clean.match(/[/\\]([^/\\]+)$/);
  return match ? match[1] : clean;
}

/** Tools whose argument is a message for the user rather than a status line. */
const USER_FACING_TOOL_NAMES = new Set(["clarify", "ask_user", "ask"]);

function _isUserFacing(toolName: string, text: string): boolean {
  return USER_FACING_TOOL_NAMES.has(toolName) || /\?["'»)\]]*\s*$/.test(text);
}

/** Whole text, whitespace collapsed so it wraps as one paragraph. */
function _whole(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** Short status label: first line only, and never cut mid-word. */
function _cap(text: string): string {
  const oneLine = text.replace(/\n[\s\S]*/, "").trim();
  if (oneLine.length <= 80) return oneLine;
  const head = oneLine.slice(0, 79);
  const lastSpace = head.lastIndexOf(" ");
  const body = lastSpace >= 40 ? head.slice(0, lastSpace) : head;
  return body.replace(/[\s,.;:—-]+$/, "") + "…";
}
