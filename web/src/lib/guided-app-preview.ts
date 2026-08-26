export interface PreviewElementRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PreviewElementContext {
  id: string;
  selector: string;
  tag: string;
  text: string;
  role: string;
  accessibleName: string;
  html: string;
  rect: PreviewElementRect;
  styles: Record<string, string>;
  comment: string;
}

export interface PreviewConsoleEntry {
  level: "error" | "warn";
  message: string;
  at: string;
}

export function normalizePreviewUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return /^(?:https?):\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
}

export function buildVisualFeedbackPrompt(input: {
  workspace: string;
  url: string;
  viewport: string;
  elements: readonly PreviewElementContext[];
  consoleEntries: readonly PreviewConsoleEntry[];
}): { prompt: string; display: string } {
  const elements = input.elements.map((element) => ({
    selector: element.selector,
    tag: element.tag,
    text: element.text,
    role: element.role,
    accessible_name: element.accessibleName,
    html: element.html,
    rect: element.rect,
    computed_styles: element.styles,
    instruction: element.comment.trim(),
  }));
  const consoleEntries = input.consoleEntries.slice(-20);
  const payload = {
    kind: "visual_element_feedback",
    workspace: input.workspace,
    preview_url: input.url,
    viewport: input.viewport,
    selected_elements: elements,
    console: consoleEntries,
  };
  const prompt = [
    "LYRA_VISUAL_FEEDBACK_BEGIN",
    JSON.stringify(payload, null, 2),
    "LYRA_VISUAL_FEEDBACK_END",
    "The user selected these rendered elements in App Preview. Keep Lyra as the visible coordinator, apply each instruction to the project, delegate only to specialists that are actually needed, and verify the changed rendered elements in the local app before reporting completion. Ask one concise question only if an instruction is genuinely ambiguous.",
  ].join("\n");
  const display = [
    `Visual feedback for ${elements.length} selected element${elements.length === 1 ? "" : "s"}:`,
    ...elements.map(
      (element) =>
        `• ${element.selector} — ${element.instruction || "Review this element"}`,
    ),
  ].join("\n");
  return { prompt, display };
}
