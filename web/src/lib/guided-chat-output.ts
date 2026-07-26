const RESPONSE_MARKER =
  /^[\s┊┋│┃└┘├┤─━╰╯>*-]*Response[\s┊┋│┃└┘├┤─━╰╯]*$/i;

const TRANSCRIPT_CHROME =
  /^(?:[┊┋│┃└┘├┤─━╰╯\s]*)(?:Tool calls?(?:\s*\(\d+\))?|Thinking\b|Terminal\(|Skills List\(|Write File\(|Read File\(|Edit File\(|Apply Patch\(|Response\b)/i;

const DIFF_LINE =
  /^(?:a\/{1,2}|b\/{1,2}|@@|[+-](?:<!DOCTYPE|<|>|[.#:]|[A-Za-z_-]+\s*[:={([])|… omitted \d+ diff)/;

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
export function presentGuidedChatOutput(raw: string): string {
  const lines = raw.replace(/\r/g, "").split("\n");
  let responseAt = -1;

  for (let index = 0; index < lines.length; index += 1) {
    if (RESPONSE_MARKER.test(lines[index].trim())) responseAt = index;
  }

  if (responseAt >= 0) {
    const response = cleanResponse(lines.slice(responseAt + 1));
    if (response) return response;
  }

  const lower = raw.toLowerCase();
  if (
    /(?:verify|checking|test|lint|typecheck|build completed|openable)/.test(lower)
  ) {
    return "I’m checking that everything works…";
  }
  if (
    /(?:write file|edit file|apply patch|creating|implement|building|coding)/.test(
      lower,
    )
  ) {
    return "I’m building your project…";
  }
  if (raw.trim()) return "Let me think…";
  return "";
}
