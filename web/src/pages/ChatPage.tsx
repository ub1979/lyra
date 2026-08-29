/**
 * ChatPage — embeds `hermes --tui` inside the dashboard.
 *
 *   <div host> (dashboard chrome)                                         .
 *     └─ <div wrapper> (rounded, dark bg, padded — the "terminal window"  .
 *         look that gives the page a distinct visual identity)            .
 *         └─ @xterm/xterm Terminal (WebGL renderer, Unicode 11 widths)    .
 *              │ onData      keystrokes → WebSocket → PTY master          .
 *              │ onResize    terminal resize → `\x1b[RESIZE:cols;rows]`   .
 *              │ write(data) PTY output bytes → VT100 parser              .
 *              ▼                                                          .
 *     WebSocket /api/pty?token=<session>                                  .
 *          ▼                                                              .
 *     FastAPI pty_ws  (hermes_cli/web_server.py)                          .
 *          ▼                                                              .
 *     POSIX PTY → `node ui-tui/dist/entry.js` → tui_gateway + AIAgent     .
 */

import { FitAddon } from "@xterm/addon-fit";
import { Unicode11Addon } from "@xterm/addon-unicode11";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { WebglAddon } from "@xterm/addon-webgl";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { Button } from "@nous-research/ui/ui/components/button";
import { Typography } from "@nous-research/ui/ui/components/typography/index";
import { cn } from "@/lib/utils";
import {
  GUIDED_SPECIALISTS_PANEL,
  guidedSpecialistModelRowClass,
} from "@/lib/guided-specialists-dialog";
import { writeGuidedPrompt } from "@/lib/guided-composer-paste";
import {
  CHAT_ATTACHMENT_ACCEPT,
  attachmentPromptBlock,
  attachmentRejection,
  attachmentSummaryLine,
  formatAttachmentSize,
  mergeAttachments,
  splitChatAttachments,
  uploadChatFile,
  type ChatFileUploadResult,
} from "@/lib/chatAttachments";
import {
  attachmentAccept,
  attachmentCapabilityNotice,
  screenAttachments,
  type ChatModelCapabilities,
} from "@/lib/chatAttachmentPolicy";
import {
  isRequiredGuidedSpecialist,
  withRequiredGuidedSpecialists,
} from "@/lib/guided-required-specialists";
import {
  EMPTY_GUIDED_USAGE,
  formatGuidedTokens,
  guidedUsageTotal,
  markGuidedWorkerStopping,
  normalizeGuidedUsage,
  updateGuidedWorkers,
  type GuidedRuntimeEventPayload,
  type GuidedUsageSnapshot,
  type GuidedWorkerRuntime,
} from "@/lib/guided-agent-runtime";
import {
  guidedPhaseProgress,
  guidedPhaseSummary,
  nextGuidedPhase,
  orderGuidedPhases,
  parseGuidedPhaseMarkers,
  shouldAdvanceGuidedPhase,
  type GuidedPhaseStep,
} from "@/lib/guided-phase-plan";
import {
  guidedApprovalChoices,
  guidedApprovalKey,
  guidedPlainLanguageTurnDirective,
  guidedRequirementsTurnDirective,
  unavailableGuidedModelAssignments,
  type GuidedApprovalChoice,
  type GuidedUnavailableModelAssignment,
} from "@/lib/guided-agent-routing";
import {
  GUIDED_MODEL_SILENCE_TIMEOUT_MS,
  GUIDED_TOOL_SILENCE_GRACE_MS,
  decideGuidedWatchdog,
  extendGuidedSubagentGrace,
  guidedCompressionTransition,
  guidedWatchdogMessage,
  isGuidedModelActivityEvent,
} from "@/lib/guided-turn-watchdog";
import {
  Activity,
  Bot,
  CheckCircle2,
  CircleStop,
  Copy,
  FolderOpen,
  MessageCircle,
  Map as MapIcon,
  Monitor,
  Paperclip,
  PanelRight,
  Pause,
  Play,
  RotateCcw,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "react-router-dom";

import { ChatSidebar } from "@/components/ChatSidebar";
import { CopyMessageButton } from "@/components/CopyMessageButton";
import { GuidedAppPreview } from "@/components/GuidedAppPreview";
import { Markdown } from "@/components/Markdown";
import { ChatSessionList } from "@/components/ChatSessionList";
import { usePageHeader } from "@/contexts/usePageHeader";
import { useI18n } from "@/i18n";
import { api, type MessagingPlatform } from "@/lib/api";
import { latchChatActivation } from "@/lib/chat-activation";
import { chatMessageCopyText } from "@/lib/chat-copy";
import { useModalBehavior } from "@/hooks/useModalBehavior";
import {
  analyzeGuidedChatOutput,
  extractAppItSkillSelection,
  friendlyActivityLabel,
  isGuidedCancellationNotice,
  sanitizeGuidedResponse,
  shouldAutoContinueGuidedWorkflow,
  type GuidedChatPresentation,
  type GuidedSpecialist,
} from "@/lib/guided-chat-output";
import { normalizeSessionTitle } from "@/lib/chat-title";
import {
  clearGuidedProjectSessionId,
  readGuidedProjectSessionId,
  selectGuidedProjectSessionId,
  writeGuidedProjectSessionId,
} from "@/lib/guided-project-session";
import {
  PTY_CONNECTING_TIMEOUT_MS,
  PTY_RECONNECT_INPUT_MESSAGE,
  PTY_RESUME_RECONNECT_THROTTLE_MS,
  type PtyConnectionState,
  shouldBlockPtyInput,
  shouldReconnectPtyOnPageResume,
} from "@/lib/pty-reconnect";
import {
  MOBILE_REPLACEMENT_WINDOW_MS,
  normalizePtyMobileInput,
  shouldTreatInputAsMobileReplacement,
} from "@/lib/pty-mobile-input";
import {
  imageFilesFromTransfer,
  transferMayContainImage,
  uploadChatImage,
} from "@/lib/chatImagePaste";
import { PluginSlot } from "@/plugins";
import { useTheme } from "@/themes";
import { useProfileScope } from "@/contexts/useProfileScope";
import {
  telegramRemoteButtonLabel,
  telegramRemoteHint,
  telegramRemoteReadiness,
} from "@/lib/telegram-remote";

// Stable per-browser token identifying THIS chat tab's keep-alive PTY session.
// Sent as ?attach=; lets a refresh/disconnect reattach to the same live process
// instead of spawning a fresh one. Per-localStorage, so other devices can't grab it.
// ``rotate`` mints a new token — used when the user explicitly starts a fresh
// session so the old keep-alive PTY is NOT reattached (the registry reaps it).
const PTY_ATTACH_TOKEN_KEY = "hermes.pty.token.chat";
function ptyAttachToken(rotate = false): string {
  let t = "";
  if (!rotate) {
    try {
      t = window.localStorage.getItem(PTY_ATTACH_TOKEN_KEY) ?? "";
    } catch {
      /* private mode / storage blocked */
    }
  }
  if (!t) {
    const a = new Uint8Array(16);
    crypto.getRandomValues(a);
    t = Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
    try {
      window.localStorage.setItem(PTY_ATTACH_TOKEN_KEY, t);
    } catch {
      /* ignore */
    }
  }
  return t;
}

// Channel id ties this chat tab's PTY child (publisher) to its sidebar
// (subscriber).  Generated once per mount so a tab refresh starts a fresh
// channel — the previous PTY child terminates with the old WS, and its
// channel auto-evicts when no subscribers remain.
function generateChannelId(scope?: string): string {
  const prefix = scope ? "chat" : "chat-fresh";
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
}

// Colors for the terminal body.  Matches the dashboard's dark teal canvas
// with cream foreground — we intentionally don't pick monokai or a loud
// theme, because the TUI's skin engine already paints the content; the
// terminal chrome just needs to sit quietly inside the dashboard.
const DEFAULT_TERMINAL_BACKGROUND = "#000000";
const DEFAULT_TERMINAL_FOREGROUND = "#f0e6d2";
const MODEL_CONNECTION_ERROR_MARKER = "[[IDRAK_MODEL_CONNECTION_ERROR]]";
const GUIDED_SKILL_MODELS_STORAGE_KEY = "idrak-it.builder.skill-models.v1";

interface GuidedMessage {
  id: string;
  role: "user" | "assistant" | "error";
  content: string;
}

interface GuidedRunningTool {
  deadline: number;
  id: string;
  label: string;
  name: string;
  startedAt: number;
}

function latestGuidedRunningTool(
  tools: ReadonlyMap<string, GuidedRunningTool>,
): GuidedRunningTool | null {
  let latest: GuidedRunningTool | null = null;
  for (const tool of tools.values()) {
    if (!latest || tool.startedAt >= latest.startedAt) latest = tool;
  }
  return latest;
}

interface GuidedAgentEventEnvelope {
  method?: string;
  params?: {
    session_id?: string;
    type?: string;
    payload?: GuidedRuntimeEventPayload & {
      allow_permanent?: boolean;
      args_text?: string;
      choices?: string[];
      command?: string;
      context?: string;
      description?: string;
      failure_reason?: string;
      goal?: string;
      kind?: string;
      message?: string;
      name?: string;
      preview?: string;
      rendered?: string;
      result_text?: string;
      summary?: string;
      smart_denied?: boolean;
      stored_session_id?: string;
      text?: string;
      tool_id?: string;
      usage?: unknown;
    };
  };
}

interface GuidedApprovalRequest {
  choices: GuidedApprovalChoice[];
  command: string;
  description: string;
}

interface GuidedModelReviewRequest {
  projectModel: string;
  provider: string;
  unavailable: GuidedUnavailableModelAssignment[];
}

const GUIDED_APPROVAL_LABELS: Record<GuidedApprovalChoice, string> = {
  always: "Always allow",
  deny: "Deny",
  once: "Allow once",
  session: "Allow this session",
};

const GUIDED_SPECIALIST_LABELS: Record<string, string> = {
  "app-it": "Lyra",
  "req-engineer": "Requirements",
  researcher: "Research",
  spec: "Technical specification",
  "ui-designer": "Design",
  "sw-architect": "Architecture",
  "task-planner": "Task planning",
  "proj-manager": "Project planning",
  "sw-developer": "Development",
  "oop-restructurer": "Code restructuring",
  debugger: "Debugging",
  "code-reviewer": "Code review",
  "ux-writer": "UX writing",
  "qa-engineer": "Quality assurance",
  "a11y-auditor": "Accessibility",
  "security-auditor": "Security",
  "devops-engineer": "Deployment",
  "tech-writer": "Documentation",
  benchmark: "Benchmarks",
  health: "Health checks",
  "context-save": "Context preservation",
  learn: "Controlled learning",
  idk_it: "Workflow coordination",
};

const GUIDED_SPECIALIST_DESCRIPTIONS: Record<string, string> = {
  "req-engineer": "Clarify goals, users, scope, and acceptance criteria.",
  researcher:
    "Investigate markets, competitors, standards, and technical choices with verified sources.",
  spec: "Turn the request into detailed, testable behavior.",
  "ui-designer":
    "Set the look and feel from real references, then review the build against it.",
  "sw-architect": "Design the system, data, APIs, and boundaries.",
  "task-planner": "Create an ordered implementation graph.",
  "proj-manager": "Build milestones, checkpoints, and delivery plans.",
  "sw-developer": "Write and integrate working application code.",
  "oop-restructurer": "Improve modules, classes, and maintainability.",
  debugger: "Find root causes and add regression coverage.",
  "code-reviewer": "Review correctness, quality, and maintainability.",
  "ux-writer": "Write the labels, empty states, and error messages users read.",
  "qa-engineer": "Test real user journeys and report reproducible bugs.",
  "a11y-auditor":
    "Audit against WCAG 2.2 with measured contrast and keyboard paths.",
  "security-auditor": "Audit authentication, data, dependencies, and secrets.",
  "devops-engineer": "Prepare CI/CD, containers, operations, and rollback.",
  "tech-writer": "Write user, developer, and API documentation.",
  benchmark: "Measure speed, reliability, and resource usage.",
  health: "Record operational health and stability baselines.",
  "context-save": "Keep decisions and progress available between sessions.",
  learn: "Record evidence-backed improvement candidates.",
};

const GUIDED_SELECTABLE_SPECIALIST_IDS = Object.keys(
  GUIDED_SPECIALIST_LABELS,
).filter((id) => id !== "app-it" && id !== "idk_it");
const APP_IT_SPECIALIST: GuidedSpecialist = { id: "app-it", label: "Lyra" };

function guidedSpecialistStorageKey(workspace: string): string {
  return `idrak-it.guided-specialists.v1:${workspace || "default"}`;
}

function readGuidedSkillModels(): Record<string, string> {
  try {
    const value = JSON.parse(
      window.localStorage.getItem(GUIDED_SKILL_MODELS_STORAGE_KEY) ?? "{}",
    ) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(
      Object.entries(value).filter(
        (entry): entry is [string, string] =>
          GUIDED_SELECTABLE_SPECIALIST_IDS.includes(entry[0]) &&
          typeof entry[1] === "string" &&
          Boolean(entry[1].trim()),
      ),
    );
  } catch {
    return {};
  }
}

function specialistIdsFromBuilderSeed(
  seed: string | null,
  workspace: string,
): string[] {
  if (seed) {
    const match = seed.match(
      /IDRAK_INTERNAL_SETUP_BEGIN\s+(.+?)\s+IDRAK_INTERNAL_SETUP_END/,
    );
    if (match) {
      try {
        const setup = JSON.parse(match[1]) as {
          enabled_specialists?: unknown;
        };
        if (Array.isArray(setup.enabled_specialists)) {
          const selected = setup.enabled_specialists.filter(
            (id): id is string =>
              typeof id === "string" && id in GUIDED_SPECIALIST_LABELS,
          );
          window.localStorage.setItem(
            guidedSpecialistStorageKey(workspace),
            JSON.stringify(selected),
          );
          return selected;
        }
      } catch {
        // A malformed setup seed should not prevent the guided chat opening.
      }
    }
  }
  try {
    const stored = JSON.parse(
      window.localStorage.getItem(guidedSpecialistStorageKey(workspace)) ??
        "[]",
    ) as unknown;
    if (Array.isArray(stored)) {
      const selected = stored.filter(
        (id): id is string =>
          typeof id === "string" && id in GUIDED_SPECIALIST_LABELS,
      );
      return selected;
    }
  } catch {
    // Fall through to workflow coordination.
  }
  return [];
}

function guidedMessageStorageKey(workspace: string): string {
  return `idrak-it.guided-messages.v1:${workspace || "default"}`;
}

function guidedPhaseStorageKey(workspace: string): string {
  return `idrak-it.guided-phases.v1:${workspace || "default"}`;
}

function readGuidedPhaseState(workspace: string): {
  completed: string[];
  current: string | null;
} {
  try {
    const value = JSON.parse(
      window.localStorage.getItem(guidedPhaseStorageKey(workspace)) ?? "{}",
    ) as { completed?: unknown; current?: unknown };
    const completed = Array.isArray(value.completed)
      ? value.completed.filter(
          (id): id is string =>
            typeof id === "string" &&
            GUIDED_SELECTABLE_SPECIALIST_IDS.includes(id),
        )
      : [];
    const current =
      typeof value.current === "string" &&
      GUIDED_SELECTABLE_SPECIALIST_IDS.includes(value.current) &&
      !completed.includes(value.current)
        ? value.current
        : null;
    return { completed: Array.from(new Set(completed)), current };
  } catch {
    return { completed: [], current: null };
  }
}

/**
 * Compact, read-only description of the project the user just opened.
 *
 * The agent already gets a three-line workspace snapshot (root, manifest,
 * verify commands) from `detect_project_facts`. What it lacked was the shape
 * of the tree and the project's own name, which it used to obtain by running
 * read_file/search_files on its first turn. Those tool calls cost ~0.1s but
 * forced a SECOND model round-trip (~12s) purely to act on the result. Doing
 * it here keeps the informed greeting and spends milliseconds instead.
 *
 * Never throws and never blocks the greeting: any failure yields "" and the
 * agent simply falls back to asking.
 */
async function fetchProjectSummary(workspace: string): Promise<string> {
  if (!workspace) return "";
  try {
    const listing = await api.listFiles(workspace);
    const entries = listing.entries ?? [];
    if (!entries.length) return "The project folder is empty.";

    const dirs = entries.filter((e) => e.is_directory).map((e) => e.name);
    const files = entries.filter((e) => !e.is_directory).map((e) => e.name);
    const CAP = 40;
    const parts: string[] = [];
    if (dirs.length) parts.push(`Folders: ${dirs.slice(0, CAP).join(", ")}`);
    if (files.length) parts.push(`Files: ${files.slice(0, CAP).join(", ")}`);

    // package.json name/description is the cheapest way to learn what the
    // project calls itself, which is what makes the greeting feel informed.
    if (files.includes("package.json")) {
      try {
        const pkg = await api.readFile(`${workspace}/package.json`);
        // The files API returns a data: URL, not raw text.
        const base64 = (pkg.data_url ?? "").split(",")[1] ?? "";
        const parsed = JSON.parse(base64 ? atob(base64) : "{}") as {
          name?: string;
          description?: string;
        };
        const named = [parsed.name, parsed.description]
          .filter(Boolean)
          .join(" — ");
        if (named) parts.push(`package.json: ${named}`);
      } catch {
        // Unreadable or non-JSON package.json is not worth failing over.
      }
    }
    return parts.join("\n");
  } catch {
    return "";
  }
}

function guidedWelcomeSeed(
  workspace: string,
  specialists: readonly string[],
  models: Readonly<Record<string, string>>,
  projectSummary: string,
): string {
  return `IDRAK_INTERNAL_SETUP_BEGIN ${JSON.stringify({
    instruction:
      "Lyra is the permanent user-facing project guide for non-technical users. Use the internal ultimate-builder:app-it skill, keep internal skill names and orchestration out of user-facing messages, and work only inside the selected workspace. Vocabulary: when speaking to the user these are AGENTS — the requirements agent, the development agent, the QA agent. Never call them skills, specialists, playbooks, or subagents in a user-facing message; those are internal words. Never show roadmap codes such as R16, change-request codes such as CR-006, migrations, schemas, filenames, raw test counts, or terms such as release-green unless the user asks for technical details. Translate them into what the user can now do. Every progress or completion update must plainly say whether the whole application is finished, what now works, what remains, and whether anything is blocked or partial. A finished task or milestone never means the whole application is finished. Every file change must be verified and committed to local Git before reporting completion or advancing phases. Stage only this task's files; never push remotely unless the user explicitly asks.",
    first_turn_gate:
      "The project listing below, together with your workspace snapshot, IS the inspection — do not call file, search, or terminal tools before greeting. Greet the user warmly as Lyra, briefly say what the project appears to be (or that it is empty) from what you were given, and ask exactly ONE short question about what they want to build or change. Inspect files later, once you know what they actually want. Recommend the smallest useful agent team later and ask permission before changing it.",
    requirements_gate:
      'Requirements is a permanent project capability, not the speaker for every turn. Activate it for the first meaningful product brief when no approved requirements exist, while its interview is active, when the user explicitly asks to revise requirements, or when a request materially changes product scope, user-visible behavior, data, permissions, integrations, or acceptance criteria. Do not activate or reload it for greetings, status questions, explanations, approvals, pause/stop commands, ordinary in-scope feedback, implementation details already covered by approved requirements, or minor fixes. If requirements.md already covers the request, Lyra handles the turn directly. When Requirements is genuinely needed, load skill_view(name="ultimate-builder:req-engineer") and run its interactive playbook in this conversation; do not delegate it. Complete its relevant interview, Grill, design-space exploration, prototype choice, requirements.md update, and approval gate before downstream work affected by that change. Once approved, emit the done marker and do not restart it unless a later material change requires a focused delta.',
    team_selection_gate:
      "Recommend only the smallest useful team. Emit APP_IT_SKILLS_SET to open editable checkboxes, but do not treat that marker as approval and do not use newly proposed agents. Wait for the user's dashboard confirmation, delivered as IDRAK_INTERNAL_SKILLS_UPDATE; that confirmed selection is authoritative.",
    project_listing: projectSummary || "(listing unavailable)",
    workspace,
    enabled_specialists: specialists,
    enabled_specialist_labels: specialists.map(
      (id) => GUIDED_SPECIALIST_LABELS[id],
    ),
    specialist_models: models,
    user_request:
      "Start this project conversation now with Lyra's greeting and first focused question.",
  })} IDRAK_INTERNAL_SETUP_END`;
}

function readGuidedMessages(workspace: string): GuidedMessage[] {
  try {
    const value = JSON.parse(
      window.localStorage.getItem(guidedMessageStorageKey(workspace)) ?? "[]",
    ) as unknown;
    if (!Array.isArray(value)) return [];
    const messages = value
      .filter(
        (item): item is GuidedMessage =>
          typeof item === "object" &&
          item !== null &&
          typeof (item as GuidedMessage).id === "string" &&
          ((item as GuidedMessage).role === "user" ||
            (item as GuidedMessage).role === "assistant" ||
            (item as GuidedMessage).role === "error") &&
          typeof (item as GuidedMessage).content === "string",
      )
      .map((message) =>
        message.role === "assistant"
          ? {
              ...message,
              content: sanitizeGuidedResponse(message.content),
            }
          : message,
      )
      .filter((message) => message.role !== "assistant" || message.content);
    const last = messages[messages.length - 1];
    if (last?.role === "user") {
      messages.push({
        id: `recovered-error-${last.id}`,
        role: "error",
        content:
          "The previous attempt ended without a response. You can retry it when ready.",
      });
    }
    return messages;
  } catch {
    return [];
  }
}

const GUIDED_WORK_PHRASES = [
  "I’m getting the ingredients ready…",
  "Cooking up the next step…",
  "Putting the pieces together…",
  "A little more magic is happening in the background…",
  "Still working—your project is on the stove…",
  "Sketching the next move…",
  "Turning your idea into something concrete…",
  "Checking the map before we move…",
  "Lining up the building blocks…",
  "Giving the details a careful look…",
  "Making sure the pieces fit…",
  "Warming up the creative engines…",
  "Following the clues through your project…",
  "Polishing the plan as it takes shape…",
  "Connecting a few important dots…",
  "Looking around the corners for surprises…",
  "Measuring twice before building once…",
  "Sorting the must-haves from the nice-to-haves…",
  "Giving your idea a sturdy backbone…",
  "Finding the simplest useful path…",
  "Keeping the tiny gremlins out of the plan…",
  "Making room for a smooth user journey…",
  "Checking that the foundations feel solid…",
  "Turning rough notes into clear decisions…",
  "Finding the friendly route through the complexity…",
  "Preparing the next piece for you…",
  "Making the experience feel natural…",
  "Testing a couple of possibilities…",
  "Choosing sensible defaults where they help…",
  "Keeping an eye on the important details…",
  "Giving the project a quick health check…",
  "Working through the tricky bits…",
  "Making the next answer easier to use…",
  "Tucking the loose ends into place…",
  "Checking the project compass…",
  "Shaping the idea into a useful flow…",
  "Making sure nothing important was forgotten…",
  "Looking for a cleaner way through…",
  "Balancing speed, quality, and simplicity…",
  "Preparing a neat little serving of progress…",
  "Giving the logic a gentle shake test…",
  "Mapping what happens next…",
  "Keeping the project train on its track…",
  "Putting names to the fuzzy parts…",
  "Making the plan friendlier for real people…",
  "Double-checking the path from idea to app…",
  "Finding the sharp edges before users do…",
  "Arranging the pieces into a clear story…",
  "Making a small leap from vague to specific…",
  "Checking the doors, windows, and escape routes…",
  "Keeping future-you out of unnecessary trouble…",
  "Turning choices into a practical next step…",
  "Making sure the clever bits stay understandable…",
  "Listening for anything that sounds off…",
  "Getting the next milestone ready…",
  "Giving the user journey a quick rehearsal…",
  "Checking that the plan can survive real life…",
  "Tidying the workbench as I go…",
  "Finding the best place to begin…",
  "Making progress one thoughtful step at a time…",
  "Checking assumptions before they become bugs…",
  "Keeping the solution useful, not fussy…",
  "Working out what matters most right now…",
  "Preparing something you can react to…",
  "Taking the scenic route around future problems…",
  "Turning the next corner carefully…",
  "Making sure the project has a clear heartbeat…",
  "Giving the next step a final polish…",
  "Keeping things moving behind the curtain…",
  "Checking the recipe against the ingredients…",
  "Making the complicated parts behave…",
  "Building a bridge to the next decision…",
  "Looking for the most helpful answer…",
  "Making this easier for the person who will use it…",
  "Packing the next update with useful detail…",
  "Almost ready to bring the next piece to the table…",
  "Keeping the wheels turning smoothly…",
  "Giving the project one more thoughtful pass…",
  "Making sure the result earns its place…",
  "Following the thread to a clear conclusion…",
  "Getting the next useful thing ready for you…",
];

const GUIDED_SPECIALIST_ETA_SECONDS: Record<string, [number, number]> = {
  // Lyra's own conversational turns are not pipeline phases. Without this row
  // every reply fell through to the idk_it coordinator estimate and advertised
  // "30s-2m" for a one-line answer.
  "app-it": [3, 20],
  "req-engineer": [20, 60],
  researcher: [30, 180],
  spec: [45, 120],
  "ui-designer": [60, 180],
  "sw-architect": [45, 120],
  "task-planner": [30, 90],
  "proj-manager": [45, 120],
  "sw-developer": [60, 240],
  "oop-restructurer": [60, 240],
  debugger: [60, 240],
  "code-reviewer": [60, 180],
  "ux-writer": [30, 120],
  "qa-engineer": [45, 180],
  "a11y-auditor": [45, 150],
  "security-auditor": [60, 240],
  "devops-engineer": [60, 240],
  "tech-writer": [45, 150],
  benchmark: [60, 240],
  health: [30, 90],
  "context-save": [20, 60],
  learn: [30, 90],
  idk_it: [30, 120],
};

/**
 * What the user calls these: agents, not skills or specialists. The ids and the
 * playbook filenames keep their original names — this is the spoken noun only,
 * so one place decides it rather than a dozen string literals.
 */
/**
 * Avatar for an agent, falling back to its initial when the artwork is missing.
 *
 * Team members are drawn from `/skill-avatars/<id>.webp` (plus a `-sad` variant
 * for the unselected card). A new agent added before its artwork exists would
 * otherwise render a broken-image glyph in the dialog and the phase strip.
 */
function GuidedAgentAvatar({
  className,
  id,
  muted = false,
}: {
  className: string;
  id: string;
  muted?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const label = GUIDED_SPECIALIST_LABELS[id] ?? id;
  if (failed) {
    return (
      <span
        aria-hidden
        className={cn(
          className,
          "grid place-items-center bg-midground/15 font-semibold text-midground",
        )}
      >
        {label.slice(0, 1).toUpperCase()}
      </span>
    );
  }
  return (
    <img
      src={`/skill-avatars/${id.replaceAll("_", "-")}${muted ? "-sad" : ""}.webp`}
      alt=""
      className={className}
      onError={() => setFailed(true)}
    />
  );
}

function guidedWorkerAvatarId(worker: GuidedWorkerRuntime): string {
  return (
    Object.entries(GUIDED_SPECIALIST_LABELS).find(
      ([, label]) => label === worker.label,
    )?.[0] ?? "app-it"
  );
}

function GuidedRuntimePanel({
  activeWorkers,
  activity,
  currentSpecialist,
  defaultModelLabel,
  lastSignalAt,
  onRetry,
  onStopWorker,
  paused,
  recentWorkers,
  runningTool,
  usage,
}: {
  activeWorkers: readonly GuidedWorkerRuntime[];
  activity: GuidedChatPresentation;
  currentSpecialist: GuidedSpecialist;
  defaultModelLabel: string;
  lastSignalAt: number;
  onRetry: () => void;
  onStopWorker: (id: string) => void;
  paused: boolean;
  recentWorkers: readonly GuidedWorkerRuntime[];
  runningTool: GuidedRunningTool | null;
  usage: GuidedUsageSnapshot;
}) {
  const model = usage.model || defaultModelLabel;
  const status = paused
    ? "Workers paused"
    : activeWorkers.length
      ? `${activeWorkers.length} working`
      : "No workers";

  return (
    <div className="flex min-h-0 flex-1 flex-col p-3 text-xs">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold uppercase tracking-[0.16em] text-text-secondary">
          Agent activity
        </span>
        <span
          className={cn(
            "h-2 w-2 shrink-0 rounded-full",
            paused
              ? "bg-warning"
              : activeWorkers.length
                ? "animate-pulse bg-emerald-400"
                : "bg-text-secondary/45",
          )}
          aria-hidden
        />
      </div>

      <div className="mt-3 rounded-lg border border-emerald-500/25 bg-emerald-500/[0.07] p-2.5">
        <div className="flex items-center gap-2 font-semibold text-emerald-400">
          <Bot className="h-3.5 w-3.5" />
          <span>Lyra available</span>
        </div>
        <p
          className="mt-1 truncate text-[10px] text-text-secondary"
          title={model}
        >
          {model}
        </p>
      </div>

      <details className="group mt-2 rounded-lg border border-current/15 bg-background-base/60">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-2.5 py-2 text-text-secondary hover:text-midground">
          <span className="inline-flex items-center gap-1.5">
            <Activity className="h-3.5 w-3.5" />
            Tokens
          </span>
          <strong className="text-midground">
            {formatGuidedTokens(guidedUsageTotal(usage))}
          </strong>
        </summary>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 border-t border-current/10 px-2.5 py-2 text-[10px]">
          <span className="text-text-secondary">Fresh</span>
          <strong className="text-right text-midground">
            {formatGuidedTokens(usage.input)}
          </strong>
          <span className="text-text-secondary">Cached</span>
          <strong className="text-right text-midground">
            {formatGuidedTokens(usage.cacheRead)}
          </strong>
          <span className="text-text-secondary">Output</span>
          <strong className="text-right text-midground">
            {formatGuidedTokens(usage.output)}
          </strong>
          <span className="text-text-secondary">Reasoning</span>
          <strong className="text-right text-midground">
            {formatGuidedTokens(usage.reasoning)}
          </strong>
          <span className="text-text-secondary">Calls</span>
          <strong className="text-right text-midground">{usage.calls}</strong>
          {usage.costUsd > 0 && (
            <>
              <span className="text-text-secondary">Cost</span>
              <strong className="text-right text-midground">
                ${usage.costUsd.toFixed(3)}
              </strong>
            </>
          )}
        </div>
      </details>

      {activity.phase === "working" && (
        <GuidedRailSpecialistActivity
          key={currentSpecialist.id}
          activity={activity}
          lastSignalAt={lastSignalAt}
          onRetry={onRetry}
          runningTool={runningTool}
          specialist={currentSpecialist}
        />
      )}

      <div className="mt-3 flex min-h-0 flex-1 flex-col">
        <p className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-wider text-text-secondary">
          <span>Project agents</span>
          <span>{status}</span>
        </p>
        <div className="mt-2 min-h-0 space-y-2 overflow-y-auto pr-0.5">
          {activeWorkers.map((worker) => (
            <article
              key={worker.id}
              className="rounded-lg border border-current/15 bg-background-base/70 p-2"
            >
              <div className="flex items-center gap-2">
                <GuidedAgentAvatar
                  id={guidedWorkerAvatarId(worker)}
                  className="h-7 w-7 shrink-0 rounded-md object-cover"
                />
                <div className="min-w-0 flex-1">
                  <strong className="block truncate text-[11px] text-midground">
                    {worker.label}
                  </strong>
                  <span className="block truncate text-[10px] text-emerald-400">
                    {worker.status === "stopping" ? "Stopping" : "Working"}
                  </span>
                </div>
                <Button
                  ghost
                  size="sm"
                  className="h-7 px-2 text-[10px]"
                  disabled={worker.status === "stopping"}
                  onClick={() => onStopWorker(worker.id)}
                  title={`Stop ${worker.label}`}
                >
                  Stop
                </Button>
              </div>
              <p className="mt-1.5 truncate text-[10px] text-text-secondary">
                {worker.lastActivity}
              </p>
              <p
                className="mt-1 truncate text-[9px] text-text-secondary/75"
                title={worker.model}
              >
                {worker.model} · {worker.calls} calls ·{" "}
                {formatGuidedTokens(
                  worker.input + worker.cacheRead + worker.output,
                )}{" "}
                tokens
              </p>
            </article>
          ))}
          {!activeWorkers.length && recentWorkers.length > 0 && (
            <p className="rounded-lg border border-current/10 px-2.5 py-2 text-[10px] text-text-secondary">
              Last: {recentWorkers[0].label} · {recentWorkers[0].status} ·{" "}
              {recentWorkers[0].calls} calls
            </p>
          )}
          {!activeWorkers.length && !recentWorkers.length && (
            <p className="rounded-lg border border-dashed border-current/15 px-2.5 py-3 text-[10px] leading-4 text-text-secondary">
              Background agents will appear here while Lyra keeps chatting
              with you.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function GuidedProgressMap({
  durable,
  steps,
}: {
  durable: boolean;
  steps: readonly GuidedPhaseStep[];
}) {
  const summary = guidedPhaseSummary(steps);
  const current = steps.find((step) => step.state === "now") ?? null;
  const blocked = steps.filter((step) => step.state === "blocked").length;

  return (
    <div className="flex min-h-0 flex-1 flex-col p-3 text-xs">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 font-semibold uppercase tracking-[0.16em] text-text-secondary">
          <MapIcon className="h-3.5 w-3.5" />
          Project map
        </span>
        <strong className="rounded-full border border-current/15 px-2 py-0.5 text-[9px] uppercase tracking-wider text-midground">
          {durable ? "Live ledger" : "Chat signals"}
        </strong>
      </div>
      <p className="mt-2 text-[9px] leading-3 text-text-secondary">
        {durable
          ? "Read from the project's verified progress record. No estimated percentage."
          : "Waiting for a project progress record; these are conversation signals only."}
      </p>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/[0.07] p-2">
          <span className="block text-[9px] uppercase tracking-wider text-text-secondary">
            Done
          </span>
          <strong className="mt-0.5 block text-base text-emerald-400">
            {summary.completed}
          </strong>
        </div>
        <div className="rounded-lg border border-current/15 bg-background-base/60 p-2">
          <span className="block text-[9px] uppercase tracking-wider text-text-secondary">
            Open
          </span>
          <strong className="mt-0.5 block text-base text-midground">
            {summary.remaining}
          </strong>
        </div>
      </div>

      {blocked > 0 && (
        <p className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/[0.08] px-2 py-1.5 text-[10px] text-amber-300">
          {blocked} {blocked === 1 ? "phase is" : "phases are"} blocked
        </p>
      )}

      {current && (
        <div className="mt-2 rounded-lg border border-midground/30 bg-midground/[0.07] p-2.5">
          <span className="block text-[9px] uppercase tracking-wider text-text-secondary">
            Working now
          </span>
          <strong className="mt-1 flex items-center gap-2 text-[11px] text-midground">
            <GuidedAgentAvatar
              id={current.id}
              className="h-6 w-6 shrink-0 rounded-md object-cover"
            />
            <span className="truncate">
              {current.label ?? guidedAgentName(current.id)}
            </span>
          </strong>
        </div>
      )}

      <div className="mt-3 min-h-0 flex-1 overflow-y-auto pr-0.5">
        {steps.length ? (
          <ol aria-label="Project delivery map" className="space-y-1.5">
            {steps.map((step) => (
              <li
                key={step.id}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-2 py-1.5",
                  step.state === "done"
                    ? "border-emerald-500/20 bg-emerald-500/[0.05]"
                    : step.state === "now"
                      ? "border-midground/35 bg-midground/[0.08]"
                      : step.state === "blocked"
                        ? "border-amber-500/25 bg-amber-500/[0.07]"
                      : "border-current/10 bg-background-base/45",
                )}
              >
                {step.state === "done" ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                ) : (
                  <GuidedAgentAvatar
                    id={step.id}
                    muted={step.state === "pending" || step.state === "blocked"}
                    className="h-4 w-4 shrink-0 rounded object-cover"
                  />
                )}
                <span
                  className={cn(
                    "min-w-0 flex-1 truncate text-[10px]",
                    step.state === "pending" || step.state === "blocked"
                      ? "text-text-secondary"
                      : "font-semibold text-midground",
                  )}
                >
                  {step.label ?? GUIDED_SPECIALIST_LABELS[step.id] ?? step.id}
                </span>
                <span
                  className={cn(
                    "shrink-0 text-[8px] font-semibold uppercase tracking-wider",
                    step.state === "done"
                      ? "text-emerald-400"
                      : step.state === "now"
                        ? "text-midground"
                        : step.state === "blocked"
                          ? "text-amber-300"
                        : "text-text-secondary/70",
                  )}
                >
                  {step.state === "done"
                    ? "Done"
                    : step.state === "now"
                      ? "Now"
                      : step.state === "blocked"
                        ? "Blocked"
                        : step.status ?? "Next"}
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="rounded-lg border border-dashed border-current/15 p-3 text-[10px] leading-4 text-text-secondary">
            Lyra will build this map after you confirm the project agents.
          </p>
        )}
      </div>
    </div>
  );
}

function guidedAgentName(id: string, label?: string): string {
  const base = label ?? GUIDED_SPECIALIST_LABELS[id] ?? id;
  return /\bagent\b/i.test(base) ? base : `${base} agent`;
}

function formatGuidedDuration(totalSeconds: number): string {
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return seconds ? `${minutes}m ${seconds}s` : `${minutes}m`;
}

function formatGuidedEta([minimum, maximum]: [number, number]): string {
  const formatBound = (seconds: number) =>
    seconds < 60 ? `${seconds}s` : `${Math.round(seconds / 60)}m`;
  return `${formatBound(minimum)}–${formatBound(maximum)}`;
}

function GuidedRailSpecialistActivity({
  activity,
  lastSignalAt,
  onRetry,
  runningTool,
  specialist,
}: {
  activity: GuidedChatPresentation;
  lastSignalAt: number;
  onRetry: () => void;
  runningTool: GuidedRunningTool | null;
  specialist: GuidedSpecialist;
}) {
  const [startedAt] = useState(() => Date.now());
  const [clock, setClock] = useState(startedAt);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setClock(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const elapsedSeconds = Math.floor((clock - startedAt) / 1000);
  const eta =
    GUIDED_SPECIALIST_ETA_SECONDS[specialist.id] ??
    GUIDED_SPECIALIST_ETA_SECONDS.idk_it;
  const phraseIndex =
    Math.floor(elapsedSeconds / 5) % GUIDED_WORK_PHRASES.length;
  const phrase = activity.text
    ? activity.text
    : GUIDED_WORK_PHRASES[phraseIndex];
  const silentSeconds = Math.max(0, Math.floor((clock - lastSignalAt) / 1000));
  const toolElapsedSeconds = runningTool
    ? Math.max(0, Math.floor((clock - runningTool.startedAt) / 1000))
    : 0;
  const mayBeStalled = !runningTool && silentSeconds >= 30;
  const isTakingLonger = elapsedSeconds > eta[1];

  return (
    <div className="mt-2 rounded-lg border border-current/15 bg-midground/5 p-2">
      <div className="flex items-start gap-2">
        <div className="guided-specialist-avatar-wrap shrink-0">
          <GuidedAgentAvatar
            id={specialist.id}
            className="guided-specialist-avatar h-7 w-7 rounded-md object-cover"
          />
          <span className="guided-specialist-dot" />
        </div>
        <div className="min-w-0">
          <strong className="block truncate text-[11px] text-midground">
            {guidedAgentName(specialist.id, specialist.label)} is working
          </strong>
          <span className="mt-0.5 block text-[10px] leading-4 text-text-secondary">
            {runningTool
              ? runningTool.label
              : mayBeStalled
              ? "No fresh response yet—it may be waiting on the AI model."
              : phrase}
          </span>
          <span
            className={cn(
              "mt-1 block text-[9px] leading-3",
              mayBeStalled ? "text-warning" : "text-text-secondary/75",
            )}
          >
            {runningTool
              ? `${formatGuidedDuration(toolElapsedSeconds)} elapsed · the tool is still running`
              : mayBeStalled
              ? `No new activity for ${formatGuidedDuration(silentSeconds)} · use Pause above if you want to stop`
              : isTakingLonger
              ? `Taking longer than usual · ${formatGuidedDuration(elapsedSeconds)} elapsed`
              : `Typical time ${formatGuidedEta(eta)} · ${formatGuidedDuration(elapsedSeconds)} elapsed`}
          </span>
          {(mayBeStalled || (runningTool && toolElapsedSeconds >= 30)) && (
            <Button
              className="mt-2 h-7 px-2 text-[10px]"
              ghost
              size="sm"
              onClick={onRetry}
            >
              {runningTool ? "Stop tool & retry" : "Stop & retry"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function guidedTerminalSnapshot(
  term: Terminal,
  turnStartLine = 0,
): {
  errorMessage: string | null;
  output: string;
  presentation: GuidedChatPresentation;
} {
  const buffer = term.buffer.active;
  const lines: string[] = [];
  const start = Math.max(turnStartLine, buffer.length - 220, 0);
  let insideInternalSetup = false;
  let modelConnectionError = false;
  let errorMessage: string | null = null;
  const technicalChrome =
    /(?:nous research|hermes|available tools|available skills|toolsets|system prompt|starting a fresh dashboard chat|\/help for commands|commits behind|run .* update|session:|voice off|try ["“]|browser:|clarify:|code_execution:|cronjob:|delegation:|file:|memory:|project:|api call failed after)/i;

  for (let index = start; index < buffer.length; index += 1) {
    const line = buffer.getLine(index)?.translateToString(true).trimEnd() ?? "";
    const trimmed = line.trim();
    if (
      /UnrecognizedClientException/i.test(trimmed) ||
      /security token included in the request is invalid/i.test(trimmed)
    ) {
      modelConnectionError = true;
      errorMessage =
        "The selected AI model could not connect because its credentials were rejected. Choose another model or reconnect its account.";
      continue;
    }
    if (/API call failed after \d+ retr/i.test(trimmed)) {
      const detail = trimmed
        .replace(/^.*?API call failed after \d+ retr(?:y|ies):?\s*/i, "")
        .trim();
      errorMessage = detail
        ? `The AI model returned an error: ${detail.slice(0, 360)}`
        : "The AI model could not complete this request. Check the selected model and retry.";
      continue;
    }
    // Cancellation bookkeeping the conversation loop writes into history
    // when a turn is cancelled mid-request. Not prose, and the next turn is
    // already running — see stripGuidedCancellationNotice.
    if (isGuidedCancellationNotice(trimmed)) continue;
    if (trimmed.includes("IDRAK_INTERNAL_SETUP_BEGIN")) {
      insideInternalSetup = !trimmed.includes("IDRAK_INTERNAL_SETUP_END");
      continue;
    }
    if (insideInternalSetup) {
      if (trimmed.includes("IDRAK_INTERNAL_SETUP_END")) {
        insideInternalSetup = false;
      }
      continue;
    }
    if (!trimmed) {
      if (lines.length && lines[lines.length - 1] !== "") lines.push("");
      continue;
    }
    if (/^[─━═┄┅┈┉┊┋│┃┌┐└┘├┤┬┴┼╭╮╰╯┏┓┗┛┣┫┳┻╋\s]+$/.test(trimmed)) {
      continue;
    }
    if (
      technicalChrome.test(trimmed) ||
      /^(?:skills|tools)\s*:\s*\d+\b/i.test(trimmed) ||
      /^\/Users\/[^/]+\/\.hermes(?:\/|$)/i.test(trimmed) ||
      /^~\/\.hermes(?:\/|$)/i.test(trimmed) ||
      /^[❯▸▾⚕!]/.test(trimmed) ||
      /[█▀▄▐▌▔▁▂▃▅▆▇]/.test(trimmed) ||
      /[⠀-⣿]/u.test(trimmed) ||
      /[╔╗╚╝═]/.test(trimmed)
    ) {
      continue;
    }
    lines.push(
      line
        .replace(/[│┃]/g, " ")
        .replace(/^[\s❯>$]+/, "")
        .trim(),
    );
  }

  const presentation = analyzeGuidedChatOutput(
    lines
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim(),
  );
  const output = [
    presentation.text,
    modelConnectionError ? MODEL_CONNECTION_ERROR_MARKER : "",
  ]
    .filter(Boolean)
    .join("\n\n");
  return { errorMessage, output, presentation };
}

function buildTerminalTheme(background: string, foreground: string) {
  return {
    background,
    foreground,
    cursor: foreground,
    cursorAccent: background,
    selectionBackground:
      foreground.length === 7 ? `${foreground}44` : foreground,
  };
}

/**
 * CSS width for xterm font tiers.
 *
 * Prefer the terminal host's `clientWidth` — Chrome DevTools device mode often
 * keeps `window.innerWidth` at the full desktop value while the *drawn* layout
 * is phone-sized, which made us pick desktop font sizes (~14px) and look huge.
 */
function terminalTierWidthPx(host: HTMLElement | null): number {
  if (typeof window === "undefined") return 1280;
  const fromHost = host?.clientWidth ?? 0;
  if (fromHost > 2) return Math.round(fromHost);
  const doc = document.documentElement?.clientWidth ?? 0;
  const vv = window.visualViewport;
  const inner = window.innerWidth;
  const vvw = vv?.width ?? inner;
  const layout = Math.min(inner, vvw, doc > 0 ? doc : inner);
  return Math.max(1, Math.round(layout));
}

function terminalFontSizeForWidth(layoutWidthPx: number): number {
  if (layoutWidthPx < 300) return 7;
  if (layoutWidthPx < 360) return 8;
  if (layoutWidthPx < 420) return 9;
  if (layoutWidthPx < 520) return 10;
  if (layoutWidthPx < 720) return 11;
  if (layoutWidthPx < 1024) return 12;
  return 14;
}

function terminalLineHeightForWidth(layoutWidthPx: number): number {
  return layoutWidthPx < 1024 ? 1.02 : 1.15;
}

function terminalComposerIsReady(term: Terminal): boolean {
  const buffer = term.buffer.active;
  const start = Math.max(0, buffer.length - 40);
  for (let index = start; index < buffer.length; index += 1) {
    const line = buffer.getLine(index)?.translateToString(true).trim() ?? "";
    if (/^[\s│┃┊┋]*❯/.test(line) || /\/help for commands/i.test(line)) {
      return true;
    }
  }
  return false;
}

export default function ChatPage({ isActive = true }: { isActive?: boolean }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  // Exposed to the main metrics-sync effect so it can refit the terminal
  // the moment `isActive` flips back to true (display:none → display:flex
  // collapses the host's box, so ResizeObserver never fires on return).
  const syncMetricsRef = useRef<(() => void) | null>(null);
  // Sticky activation latch: the PTY-connect effect below must not open
  // `/api/pty` until the chat tab has actually been active at least once.
  // The dashboard mounts ChatPage persistently (hidden) on every route, so
  // without this gate merely loading /sessions, /system, etc. would spawn the
  // TUI/agent bootstrap (`Installing TUI dependencies…`). Latching keeps the
  // PTY alive across later tab switches (the persistence UX) — once true it
  // stays true.
  const [hasActivated, setHasActivated] = useState(isActive);
  useEffect(() => {
    setHasActivated((prev) => latchChatActivation(prev, isActive));
  }, [isActive]);
  const [searchParams, setSearchParams] = useSearchParams();
  const guided = searchParams.get("guided") === "1";
  const workspaceParam = searchParams.get("workspace")?.trim() ?? "";
  const builderParam = searchParams.get("builder");
  const resumeParam = searchParams.get("resume");
  const projectName =
    workspaceParam.split(/[\\/]/).filter(Boolean).pop() ?? "Project";
  const [guidedOutput, setGuidedOutput] = useState("");
  const [guidedActivity, setGuidedActivity] = useState<GuidedChatPresentation>({
    phase: "idle",
    text: "",
    specialist: null,
  });
  const [guidedLastSignalAt, setGuidedLastSignalAt] = useState(Date.now);
  const [guidedCompacting, setGuidedCompacting] = useState(false);
  const [guidedMessages, setGuidedMessages] = useState<GuidedMessage[]>(() =>
    typeof window === "undefined" ? [] : readGuidedMessages(workspaceParam),
  );
  const guidedMessagesRef = useRef(guidedMessages);
  const guidedWelcomeStartedRef = useRef(false);
  const [guidedMessageWorkspace, setGuidedMessageWorkspace] =
    useState(workspaceParam);
  const [guidedSelectedSpecialistIds, setGuidedSelectedSpecialistIds] =
    useState(() =>
    typeof window === "undefined"
      ? []
      : specialistIdsFromBuilderSeed(
          searchParams.get("builder"),
          workspaceParam,
        ),
  );
  const guidedDefaultSpecialist = APP_IT_SPECIALIST;
  const guidedDefaultSpecialistRef = useRef<GuidedSpecialist>(
    guidedDefaultSpecialist,
  );
  const guidedSelectedSpecialistIdsRef = useRef(guidedSelectedSpecialistIds);
  // Front door only — see applyGuidedSpecialistIds. This initial value is what
  // a session connecting before the first apply() sends, so it must match.
  const guidedSessionSkillsRef = useRef(["ultimate-builder:app-it"]);
  const guidedTurnStartLineRef = useRef(0);
  const lastGuidedResponseRef = useRef("");
  const guidedTurnSettledRef = useRef(true);
  const guidedStructuredFeedConnectedRef = useRef(false);
  // Epoch ms until which a specialist phase may stay silent, or 0 when no
  // phase is running. A boolean flag here used to disable the silence watchdog
  // outright, and it was set by `subagent.spawn_requested` — a spawn *request*.
  // A spawn that never started left the watchdog re-arming itself every 75s,
  // so the turn ran until the user gave up (42 minutes, in one report).
  const guidedSubagentGraceUntilRef = useRef(0);
  // Ordinary tools have their own lifecycle and backend timeout. Track every
  // active id (parallel calls are common) so the two-minute model watchdog
  // cannot kill a healthy command while another tool completes first.
  const guidedActiveToolsRef = useRef<Map<string, GuidedRunningTool>>(new Map());
  const [guidedRunningTool, setGuidedRunningTool] =
    useState<GuidedRunningTool | null>(null);
  const guidedAutoContinueCountRef = useRef(0);
  // Phase chain, driven by Lyra's [APP_IT_PHASE:...] / [APP_IT_PHASE_DONE:...]
  // markers rather than inferred from her prose.
  const [initialGuidedPhaseState] = useState(() =>
    typeof window === "undefined"
      ? { completed: [] as string[], current: null as string | null }
      : readGuidedPhaseState(workspaceParam),
  );
  const [guidedPhaseCurrent, setGuidedPhaseCurrent] = useState<string | null>(
    initialGuidedPhaseState.current,
  );
  const [guidedPhasesCompleted, setGuidedPhasesCompleted] = useState<string[]>(
    initialGuidedPhaseState.completed,
  );
  const [guidedLedger, setGuidedLedger] = useState<{
    workspace: string;
    steps: GuidedPhaseStep[] | null;
  } | null>(null);
  const guidedPhaseCurrentRef = useRef<string | null>(
    initialGuidedPhaseState.current,
  );
  /** Phase to nudge after the current reply, set by finishGuidedResponse. */
  const guidedPhaseAdvanceRef = useRef<string | null>(null);
  const guidedPhasesCompletedRef = useRef<string[]>(
    initialGuidedPhaseState.completed,
  );
  const [guidedInput, setGuidedInput] = useState("");
  const [guidedPreviewOpen, setGuidedPreviewOpen] = useState(false);
  const [guidedAttachments, setGuidedAttachments] = useState<File[]>([]);
  // What the model in use can actually accept. Drives the picker's accept list,
  // the refusals, and the composer hint.
  const [guidedModelCaps, setGuidedModelCaps] = useState<ChatModelCapabilities>(
    {},
  );
  const [guidedAttachBusy, setGuidedAttachBusy] = useState(false);
  const [guidedDragActive, setGuidedDragActive] = useState(false);
  const guidedFileInputRef = useRef<HTMLInputElement>(null);
  const [guidedSkillsOpen, setGuidedSkillsOpen] = useState(false);
  const [guidedSkillDraftIds, setGuidedSkillDraftIds] = useState<string[]>([]);
  const [guidedSkillModels, setGuidedSkillModels] = useState<
    Record<string, string>
  >(() => (typeof window === "undefined" ? {} : readGuidedSkillModels()));
  const [guidedSkillModelDraft, setGuidedSkillModelDraft] = useState<
    Record<string, string>
  >({});
  const guidedSkillModelsRef = useRef(guidedSkillModels);
  const [guidedModelOptions, setGuidedModelOptions] = useState<string[]>([]);
  const [guidedDefaultModelLabel, setGuidedDefaultModelLabel] =
    useState("Project default");
  const [guidedUsage, setGuidedUsage] =
    useState<GuidedUsageSnapshot>(EMPTY_GUIDED_USAGE);
  const [guidedApproval, setGuidedApproval] =
    useState<GuidedApprovalRequest | null>(null);
  const [guidedModelReview, setGuidedModelReview] =
    useState<GuidedModelReviewRequest | null>(null);
  const guidedModelReviewRef = useRef<GuidedModelReviewRequest | null>(null);
  const [guidedWorkers, setGuidedWorkers] = useState<GuidedWorkerRuntime[]>([]);
  const [guidedRecommendedSpecialistIds, setGuidedRecommendedSpecialistIds] =
    useState<string[]>([]);
  const [guidedTeamRecommendationPending, setGuidedTeamRecommendationPending] =
    useState(false);
  const [guidedPaused, setGuidedPaused] = useState(false);
  const [guidedAgentReady, setGuidedAgentReady] = useState(false);
  const [guidedReadyTimedOut, setGuidedReadyTimedOut] = useState(false);
  const [guidedSessionLookupWorkspace, setGuidedSessionLookupWorkspace] =
    useState("");
  const [telegramPlatform, setTelegramPlatform] =
    useState<MessagingPlatform | null>(null);
  const [telegramRemoteLoading, setTelegramRemoteLoading] = useState(false);
  const [telegramHandoffStatus, setTelegramHandoffStatus] = useState<
    "idle" | "sending" | "sent" | "failed"
  >("idle");
  const telegramHandoffRequestedRef = useRef(false);
  const guidedAgentReadyRef = useRef(false);
  const guidedOutputRef = useRef<HTMLDivElement | null>(null);
  const guidedAutoScrollRef = useRef(true);
  const hasModelConnectionError = guidedOutput.includes(
    MODEL_CONNECTION_ERROR_MARKER,
  );
  const telegramReadiness = telegramRemoteReadiness(telegramPlatform);
  // The declared phase wins over the specialist inferred from output text: a
  // phase Lyra runs in the conversation herself (requirements) emits no
  // subagent events, so inference always fell back to Lyra.
  const guidedPhaseSpecialist = guidedPhaseCurrent
    ? {
        id: guidedPhaseCurrent,
        label:
          GUIDED_SPECIALIST_LABELS[guidedPhaseCurrent] ?? guidedPhaseCurrent,
      }
    : null;
  const guidedWorkingSpecialist =
    guidedActivity.specialist ??
    guidedPhaseSpecialist ??
    guidedDefaultSpecialist;
  const guidedActiveWorkers = guidedWorkers.filter(
    (worker) => worker.status === "running" || worker.status === "stopping",
  );
  const guidedRecentWorkers = guidedWorkers.filter(
    (worker) => worker.status !== "running" && worker.status !== "stopping",
  );
  const guidedUnavailableDraftModels = unavailableGuidedModelAssignments(
    guidedSkillModelDraft,
    guidedSkillDraftIds,
    guidedModelOptions,
  );
  const guidedLedgerSteps =
    guidedLedger?.workspace === workspaceParam ? guidedLedger.steps : null;
  const guidedPhaseSteps =
    guidedLedgerSteps ??
    guidedPhaseProgress({
      completed: guidedPhasesCompleted,
      current: guidedPhaseCurrent,
      ordered: orderGuidedPhases(guidedSelectedSpecialistIds),
    });
  const guidedProgressSummary = guidedPhaseSummary(guidedPhaseSteps);
  const latestGuidedMessage = guidedMessages[guidedMessages.length - 1] ?? null;
  const showRequirementsApproval =
    guidedActivity.phase === "idle" &&
    latestGuidedMessage?.role === "assistant" &&
    guidedSelectedSpecialistIds.includes("req-engineer") &&
    /requirements? (?:summary|are ready)|approve requirements?/i.test(
      latestGuidedMessage.content,
    ) &&
    /(?:reply\s+\**approve|does this match|for (?:your )?approval)/i.test(
      latestGuidedMessage.content,
    );
  const showWorkflowApproval =
    !showRequirementsApproval &&
    guidedActivity.phase === "idle" &&
    latestGuidedMessage?.role === "assistant" &&
    /\b(?:reply\s+\**approve|approve to continue|approval before)\b/i.test(
      latestGuidedMessage.content,
    );
  const showRequirementChoices =
    !showRequirementsApproval &&
    !showWorkflowApproval &&
    guidedActivity.phase === "idle" &&
    latestGuidedMessage?.role === "assistant" &&
    guidedSelectedSpecialistIds.includes("req-engineer") &&
    /[?？]/.test(latestGuidedMessage.content);
  // Lazy-init: the missing-token check happens at construction so the effect
  // body doesn't have to setState (React 19's set-state-in-effect rule).
  // In gated (OAuth) mode the server intentionally omits the session token —
  // the dashboard API layer authenticates the WS via a single-use ticket,
  // so a missing token there is expected, not an error.
  const [banner, setBanner] = useState<string | null>(() =>
    typeof window !== "undefined" &&
    !window.__IDRAK_IT_SESSION_TOKEN__ &&
    !window.__IDRAK_IT_AUTH_REQUIRED__
      ? "Session token unavailable. Open this page through the Lyra launcher."
      : null,
  );
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");
  const copyResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptRef = useRef(0);
  const forceFreshPtyRef = useRef(false);
  const blockedInputNoticeRef = useRef(false);
  const lastResumeReconnectAtRef = useRef(0);
  const appendGuidedError = useCallback((content: string) => {
    setGuidedMessages((messages) => {
      const last = messages[messages.length - 1];
      if (last?.role === "error" && last.content === content) return messages;
      return [
        ...messages,
        {
          id: `error-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          role: "error",
          content,
        },
      ];
    });
  }, []);

  const markGuidedAgentReady = useCallback(() => {
    guidedAgentReadyRef.current = true;
    setGuidedAgentReady(true);
    setGuidedReadyTimedOut(false);
  }, []);

  useEffect(() => {
    guidedMessagesRef.current = guidedMessages;
  }, [guidedMessages]);

  const applyGuidedSpecialistIds = useCallback(
    (ids: readonly string[]) => {
      // Requirements is pinned here rather than at each caller: the team can
      // be set from the ?builder= URL, the specialists dialog, or Lyra's own
      // confirmed dashboard selections all land in this function.
      const selected = withRequiredGuidedSpecialists(
        ids,
        GUIDED_SELECTABLE_SPECIALIST_IDS,
      );
      setGuidedSelectedSpecialistIds(selected);
      guidedSelectedSpecialistIdsRef.current = selected;
      guidedDefaultSpecialistRef.current = APP_IT_SPECIALIST;
      // Only the front-door skill is preloaded. app-it loads the umbrella
      // workflow itself via skill_view once the team is approved and work
      // starts — preloading it here put ~2.1k tokens of always-on SDLC
      // pipeline rules in front of ordinary conversation, which app-it's own
      // SKILL.md explicitly forbids.
      guidedSessionSkillsRef.current = ["ultimate-builder:app-it"];
      try {
        window.localStorage.setItem(
          guidedSpecialistStorageKey(workspaceParam),
          JSON.stringify(selected),
        );
      } catch {
        // Storage can be unavailable in private browsing; live state still works.
      }
    },
    [workspaceParam],
  );

  useEffect(() => {
    if (!guided || !isActive) return;
    let active = true;
    Promise.all([api.getModelInfo(), api.getModelOptions()])
      .then(([info, options]) => {
        if (!active) return;
        const providers = options.providers ?? [];
        const provider =
          providers.find((item) => item.slug === info.provider) ??
          providers.find((item) => item.is_current);
        const providerModels = Array.from(
          new Set((provider?.models ?? []).filter(Boolean)),
        );
        setGuidedModelOptions(providerModels);
        const unavailable = unavailableGuidedModelAssignments(
          guidedSkillModelsRef.current,
          guidedSelectedSpecialistIdsRef.current,
          providerModels,
        );
        if (unavailable.length) {
          const review: GuidedModelReviewRequest = {
            projectModel: info.model,
            provider: info.provider,
            unavailable,
          };
          guidedModelReviewRef.current = review;
          setGuidedModelReview(review);
          setGuidedTeamRecommendationPending(false);
          setGuidedRecommendedSpecialistIds([]);
          setGuidedSkillDraftIds(
            withRequiredGuidedSpecialists(
              guidedSelectedSpecialistIdsRef.current,
              GUIDED_SELECTABLE_SPECIALIST_IDS,
            ),
          );
          setGuidedSkillModelDraft({ ...guidedSkillModelsRef.current });
          setGuidedSkillsOpen(true);
          const labels = unavailable.map(
            ({ agentId }) => GUIDED_SPECIALIST_LABELS[agentId] ?? agentId,
          );
          setBanner(
            `Choose replacement models for ${labels.join(", ")} after switching to ${info.provider}. ` +
              "Lyra will not guess or silently replace them.",
          );
        } else if (guidedModelReviewRef.current) {
          guidedModelReviewRef.current = null;
          setGuidedModelReview(null);
        }
        setGuidedDefaultModelLabel(
          [info.provider, info.model].filter(Boolean).join(" · ") ||
            "Project default",
        );
        setGuidedUsage((current) => ({
          ...current,
          model: info.model || current.model,
        }));
        setGuidedModelCaps({
          model: info.model,
          supportsVision: info.capabilities?.supports_vision ?? null,
        });
      })
      .catch(() => {
        if (active) setGuidedModelOptions([]);
      });
    return () => {
      active = false;
    };
  }, [guided, isActive]);

  // ChatPage stays mounted while the user visits model settings. When they
  // return, reload the newly selected project's own transcript instead of
  // retaining the empty settings-route scope (or another project's history).
  useEffect(() => {
    if (!guided || guidedMessageWorkspace === workspaceParam) return;
    const phaseState = readGuidedPhaseState(workspaceParam);
    setGuidedMessages(readGuidedMessages(workspaceParam));
    setGuidedMessageWorkspace(workspaceParam);
    setGuidedPhaseCurrent(phaseState.current);
    setGuidedPhasesCompleted(phaseState.completed);
    guidedPhaseCurrentRef.current = phaseState.current;
    guidedPhasesCompletedRef.current = phaseState.completed;
    guidedWelcomeStartedRef.current = false;
    lastGuidedResponseRef.current = "";
    guidedTurnSettledRef.current = true;
    setGuidedActivity({ phase: "idle", text: "", specialist: null });
    setGuidedWorkers([]);
    setGuidedApproval(null);
    guidedModelReviewRef.current = null;
    setGuidedModelReview(null);
    setGuidedRecommendedSpecialistIds([]);
    setGuidedTeamRecommendationPending(false);
  }, [guided, guidedMessageWorkspace, workspaceParam]);

  // Keep the preloaded skill set aligned with the project URL as the
  // persistent ChatPage moves between the launcher, model settings, and chat.
  useEffect(() => {
    if (!guided) return;
    const selected = specialistIdsFromBuilderSeed(
      searchParams.get("builder"),
      workspaceParam,
    );
    applyGuidedSpecialistIds(selected);
  }, [applyGuidedSpecialistIds, guided, searchParams, workspaceParam]);
  const finishGuidedResponse = useCallback((content: string) => {
    // Phase markers come off first: they are stripped from what the user reads
    // and they, not the wording of the reply, decide who is working and what
    // runs next.
    const phases = parseGuidedPhaseMarkers(
      content,
      GUIDED_SELECTABLE_SPECIALIST_IDS,
    );
    const startedPhase = phases.started[phases.started.length - 1] ?? null;
    if (phases.completed.length) {
      const merged = Array.from(
        new Set([...guidedPhasesCompletedRef.current, ...phases.completed]),
      );
      guidedPhasesCompletedRef.current = merged;
      setGuidedPhasesCompleted(merged);
    }
    if (startedPhase) {
      guidedPhaseCurrentRef.current = startedPhase;
      setGuidedPhaseCurrent(startedPhase);
    } else if (
      guidedPhaseCurrentRef.current &&
      phases.completed.includes(guidedPhaseCurrentRef.current)
    ) {
      guidedPhaseCurrentRef.current = null;
      setGuidedPhaseCurrent(null);
    }

    const skillSelection = extractAppItSkillSelection(
      phases.content,
      GUIDED_SELECTABLE_SPECIALIST_IDS,
    );
    // A marker is a proposal, never permission. Lyra can recommend the smallest
    // useful team, but the editable dashboard confirmation is the only place a
    // recommendation becomes project state.
    if (skillSelection) {
      const recommended = withRequiredGuidedSpecialists(
        skillSelection.skillIds,
        GUIDED_SELECTABLE_SPECIALIST_IDS,
      );
      setGuidedRecommendedSpecialistIds(recommended);
      setGuidedSkillDraftIds(recommended);
      setGuidedSkillModelDraft({ ...guidedSkillModelsRef.current });
      setGuidedTeamRecommendationPending(true);
      setGuidedSkillsOpen(true);
    }
    const response = sanitizeGuidedResponse(
      skillSelection?.content ?? phases.content,
    );
    if (!response || response === lastGuidedResponseRef.current) return;

    // Deterministic advancement: a phase reported a verified artifact, another
    // enabled phase is still outstanding, and the reply is not asking the user
    // anything. The prose-regex path below stays as a fallback for replies that
    // carry no markers at all.
    const orderedPhases = orderGuidedPhases(
      guidedSelectedSpecialistIdsRef.current,
    );
    const upcoming = nextGuidedPhase({
      completed: guidedPhasesCompletedRef.current,
      current: guidedPhaseCurrentRef.current,
      ordered: orderedPhases,
    });
    guidedPhaseAdvanceRef.current = shouldAdvanceGuidedPhase({
      completedInReply: phases.completed,
      next: upcoming,
      reply: response,
    })
      ? upcoming
      : null;
    guidedTurnSettledRef.current = true;
    lastGuidedResponseRef.current = response;
    setGuidedLastSignalAt(Date.now());
    setGuidedOutput(response);
    setGuidedActivity({ phase: "idle", text: "", specialist: null });
    setGuidedMessages((messages) => {
      const last = messages[messages.length - 1];
      if (last?.role === "assistant") {
        return [...messages.slice(0, -1), { ...last, content: response }];
      }
      return [
        ...messages,
        {
          id: `assistant-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          role: "assistant",
          content: response,
        },
      ];
    });
  }, []);
  // True from the moment the connect effect begins until the socket resolves
  // (open or close). Guards the page-resume reconnect against firing during
  // the async ticket/URL await gap where wsRef.current is not yet assigned.
  const connectInFlightRef = useRef(false);
  const connectingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ptyInputLineRef = useRef("");
  const mobileReplacementInputUntilRef = useRef(0);
  const [ptyState, setPtyState] = useState<PtyConnectionState>("connecting");
  const ptyStateRef = useRef<PtyConnectionState>("connecting");
  const [lastCloseCode, setLastCloseCode] = useState<number | null>(null);
  // NS-504: when the agent process exits cleanly (the user typed `/exit`, or
  // started a new session that ended the current PTY child), the PTY socket
  // closes with a normal code. Before this fix the terminal just printed
  // "[session ended]" and went dead — the only recovery was a full page
  // refresh. `ptyState === "ended"` renders an explicit "Start new session"
  // affordance; clicking it bumps `reconnectNonce`, which is a dependency of
  // the connect effect, so a fresh PTY spawns in place.
  const [reconnectNonce, setReconnectNonce] = useState(0);
  useEffect(() => {
    ptyStateRef.current = ptyState;
  }, [ptyState]);
  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);
  const reconnectPty = useCallback(() => {
    forceFreshPtyRef.current = false;
    reconnectAttemptRef.current = 0;
    clearReconnectTimer();
    blockedInputNoticeRef.current = false;
    ptyInputLineRef.current = "";
    mobileReplacementInputUntilRef.current = 0;
    setBanner(null);
    setLastCloseCode(null);
    guidedAgentReadyRef.current = false;
    setGuidedAgentReady(false);
    setGuidedReadyTimedOut(false);
    setPtyState("connecting");
    setReconnectNonce((n) => n + 1);
  }, [clearReconnectTimer]);
  const startFreshPty = useCallback(() => {
    forceFreshPtyRef.current = true;
    reconnectAttemptRef.current = 0;
    clearReconnectTimer();
    blockedInputNoticeRef.current = false;
    ptyInputLineRef.current = "";
    mobileReplacementInputUntilRef.current = 0;
    setBanner(null);
    setLastCloseCode(null);
    guidedAgentReadyRef.current = false;
    setGuidedAgentReady(false);
    setGuidedReadyTimedOut(false);
    setPtyState("connecting");
    setReconnectNonce((n) => n + 1);
  }, [clearReconnectTimer]);
  const startFreshDashboardChat = useCallback(() => {
    const next = new URLSearchParams(searchParams);

    next.delete("resume");
    forceFreshPtyRef.current = true;
    reconnectAttemptRef.current = 0;
    clearReconnectTimer();
    blockedInputNoticeRef.current = false;
    ptyInputLineRef.current = "";
    mobileReplacementInputUntilRef.current = 0;
    setGuidedSessionLookupWorkspace(workspaceParam);
    setSearchParams(next, { replace: true });
    setBanner(null);
    setLastCloseCode(null);
    setPtyState("connecting");
    setReconnectNonce((n) => n + 1);
  }, [
    clearReconnectTimer,
    searchParams,
    setSearchParams,
    workspaceParam,
  ]);
  const clearGuidedHistory = useCallback(() => {
    if (
      !window.confirm(
        "Clear this project’s chat history and start a fresh conversation?",
      )
    ) {
      return;
    }
    try {
      wsRef.current?.send("\x03");
    } catch {
      // The fresh-session reconnect below is sufficient if the socket closed.
    }
    try {
      window.localStorage.removeItem(guidedMessageStorageKey(workspaceParam));
      window.localStorage.removeItem(guidedPhaseStorageKey(workspaceParam));
      clearGuidedProjectSessionId(workspaceParam);
    } catch {
      // State still clears when browser storage is unavailable.
    }
    setGuidedMessages([]);
    setGuidedOutput("");
    setGuidedInput("");
    setGuidedPaused(false);
    setGuidedUsage((current) => ({
      ...EMPTY_GUIDED_USAGE,
      model: current.model,
    }));
    setGuidedWorkers([]);
    setGuidedRecommendedSpecialistIds([]);
    setGuidedTeamRecommendationPending(false);
    setGuidedPhaseCurrent(null);
    setGuidedPhasesCompleted([]);
    guidedPhaseCurrentRef.current = null;
    guidedPhasesCompletedRef.current = [];
    guidedSubagentGraceUntilRef.current = 0;
    guidedActiveToolsRef.current = new Map();
    setGuidedCompacting(false);
    setGuidedRunningTool(null);
    setGuidedActivity({ phase: "idle", text: "", specialist: null });
    lastGuidedResponseRef.current = "";
    guidedTurnSettledRef.current = true;
    startFreshDashboardChat();
  }, [startFreshDashboardChat, workspaceParam]);
  // Raw state for the mobile side-sheet + a derived value that force-
  // closes whenever the chat tab isn't active.  The *derived* value is
  // what side-effects (body-scroll lock, keydown listener, portal render)
  // key on — that way switching to another tab triggers the effect's
  // cleanup, releasing the scroll-lock on /sessions etc.  Returning to
  // /chat re-runs the effect (derived flips back to true) and re-locks.
  // Keying on the raw state would leak the body.overflow="hidden" across
  // tabs because the dep wouldn't change on tab switch.
  const [mobilePanelOpenRaw, setMobilePanelOpenRaw] = useState(false);
  const mobilePanelOpen = isActive && mobilePanelOpenRaw;
  const { setEnd, setTitle } = usePageHeader();
  const [sessionTitleState, setSessionTitleState] = useState<{
    scope: string;
    title: string | null;
  }>({ scope: "", title: null });
  const { t } = useI18n();
  const closeMobilePanel = useCallback(() => setMobilePanelOpenRaw(false), []);
  const modelToolsLabel = useMemo(
    () => `${t.app.modelToolsSheetTitle} ${t.app.modelToolsSheetSubtitle}`,
    [t.app.modelToolsSheetSubtitle, t.app.modelToolsSheetTitle],
  );
  const [portalRoot] = useState<HTMLElement | null>(() =>
    typeof document !== "undefined" ? document.body : null,
  );
  // Standard modal behaviour, matching every other dialog in the dashboard:
  // locks page scroll, closes on Escape, restores focus on close.
  const guidedSkillsDialogRef = useModalBehavior<HTMLElement>({
    open: Boolean(guided && guidedSkillsOpen),
    onClose: () => setGuidedSkillsOpen(false),
  });
  const [narrow, setNarrow] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(max-width: 1023px)").matches
      : false,
  );

  const { theme } = useTheme();
  const terminalBg = theme.terminalBackground ?? DEFAULT_TERMINAL_BACKGROUND;
  const terminalFg = theme.terminalForeground ?? DEFAULT_TERMINAL_FOREGROUND;
  const terminalTheme = useMemo(
    () => buildTerminalTheme(terminalBg, terminalFg),
    [terminalBg, terminalFg],
  );

  // The dashboard keeps ChatPage mounted persistently so the PTY survives tab
  // switches. That is great for ordinary /chat navigation, but it means query
  // param changes do NOT remount the component. Resume-in-chat from the
  // Sessions page relies on `/chat?resume=<id>` changing at runtime, so we must
  // treat the current resume target as part of the PTY identity and rebuild the
  // terminal session when it changes.
  // Profile-scoped chat: spawn the PTY under the globally selected
  // management profile. Changing it remounts the terminal (key below /
  // effect dep) so the user explicitly starts a fresh scoped session.
  const { profile: scopedProfile } = useProfileScope();
  const guidedSessionLookupComplete =
    !guided ||
    !workspaceParam ||
    Boolean(builderParam) ||
    guidedSessionLookupWorkspace === workspaceParam;

  useEffect(() => {
    if (guidedSessionLookupComplete) return;
    let cancelled = false;

    const resolveProjectSession = async () => {
      const storedSessionId = readGuidedProjectSessionId(workspaceParam);
      let sessionId = storedSessionId;
      try {
        const page = await api.getSessions(
          100,
          0,
          scopedProfile,
          "recent",
          workspaceParam,
        );
        sessionId = selectGuidedProjectSessionId(
          page.sessions,
          workspaceParam,
          storedSessionId,
        );
      } catch {
        // A saved project chat remains available if validation fails.
      }
      if (cancelled) return;
      if (sessionId) {
        writeGuidedProjectSessionId(workspaceParam, sessionId);
        setGuidedSessionLookupWorkspace(workspaceParam);
        const next = new URLSearchParams(searchParams);
        next.set("resume", sessionId);
        setSearchParams(next, { replace: true });
        return;
      }
      setGuidedSessionLookupWorkspace(workspaceParam);
    };

    void resolveProjectSession();
    return () => {
      cancelled = true;
    };
  }, [
    guidedSessionLookupComplete,
    scopedProfile,
    searchParams,
    setSearchParams,
    workspaceParam,
  ]);

  useEffect(() => {
    if (!guided || !workspaceParam) return;
    let cancelled = false;

    const refreshLedger = async () => {
      try {
        const state = await api.getUltimateBuilderState(workspaceParam);
        if (cancelled) return;
        setGuidedLedger({
          workspace: workspaceParam,
          steps: state.phase_state.available
            ? state.phase_state.phases.map((phase) => ({
                id: phase.id,
                label: phase.label,
                state: phase.state,
                status: phase.status,
              }))
            : null,
        });
      } catch {
        // The builder plugin may be disabled; keep conversation signals as a
        // clearly labelled fallback instead of claiming verified progress.
      }
    };

    void refreshLedger();
    const timer = window.setInterval(() => void refreshLedger(), 5_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [guided, workspaceParam]);
  useEffect(() => {
    if (!guided || !isActive) return;
    let cancelled = false;
    let first = true;

    const refreshTelegram = async () => {
      if (first) setTelegramRemoteLoading(true);
      try {
        const response = await api.getMessagingPlatforms();
        if (cancelled) return;
        setTelegramPlatform(
          response.platforms.find((platform) => platform.id === "telegram") ??
            null,
        );
      } catch {
        if (!cancelled) setTelegramPlatform(null);
      } finally {
        first = false;
        if (!cancelled) setTelegramRemoteLoading(false);
      }
    };

    void refreshTelegram();
    const timer = window.setInterval(() => void refreshTelegram(), 10_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [guided, isActive, scopedProfile]);
  const channel = useMemo(
    () => generateChannelId(`${resumeParam ?? ""}\0${scopedProfile}`),
    [resumeParam, scopedProfile],
  );
  const titleScope = `${channel}\0${reconnectNonce}`;
  const sessionTitle =
    sessionTitleState.scope === titleScope ? sessionTitleState.title : null;
  const handleSessionTitleChange = useCallback(
    (title: string | null) =>
      setSessionTitleState({ scope: titleScope, title }),
    [titleScope],
  );

  // Guided chat is intentionally terminal-free, so consume the PTY agent's
  // structured event stream directly. `message.complete` is the authoritative
  // turn-settled signal; terminal scraping remains only a compatibility
  // fallback for older servers. This prevents a completed turn from looking
  // stuck merely because terminal wrapping hid the visual "Response" marker.
  useEffect(() => {
    if (
      !guided ||
      !channel ||
      !hasActivated ||
      !guidedSessionLookupComplete
    ) {
      return;
    }

    let unmounting = false;
    let ws: WebSocket | null = null;
    let streamedText = "";
    let reconnectAttempt = 0;
    let reconnectTimer: number | null = null;

    const scheduleReconnect = () => {
      if (unmounting || reconnectTimer !== null) return;
      const delay = Math.min(5000, 500 * 2 ** reconnectAttempt);
      reconnectAttempt += 1;
      reconnectTimer = window.setTimeout(() => {
        reconnectTimer = null;
        void connect();
      }, delay);
    };

    const connect = async () => {
      try {
      const url = await api.buildWsUrl("/api/events", { channel });
      if (unmounting) return;
        const socket = new WebSocket(url);
        ws = socket;
        socket.addEventListener("open", () => {
          reconnectAttempt = 0;
        guidedStructuredFeedConnectedRef.current = true;
      });
        socket.addEventListener("close", () => {
          if (ws !== socket) return;
        guidedStructuredFeedConnectedRef.current = false;
          scheduleReconnect();
      });

        socket.addEventListener("message", (event) => {
        let frame: GuidedAgentEventEnvelope;
        try {
          frame = JSON.parse(event.data);
        } catch {
          return;
        }
        if (frame.method !== "event" || !frame.params?.type) return;

        const { type, payload } = frame.params;
        const compressionTransition = guidedCompressionTransition(
          type,
          payload?.kind,
        );
        if (compressionTransition === "start") {
          guidedTurnSettledRef.current = false;
          setGuidedCompacting(true);
          setGuidedLastSignalAt(Date.now());
          setGuidedActivity((current) => ({
            phase: "working",
            text: "Summarizing the conversation so Lyra can continue…",
            specialist:
              current.specialist ?? guidedDefaultSpecialistRef.current,
          }));
          return;
        }
        if (compressionTransition === "finish") {
          setGuidedCompacting(false);
          if (type === "status.update") {
            setGuidedLastSignalAt(Date.now());
            setGuidedActivity((current) => ({
              phase: "working",
              text: "Conversation summarized. Continuing…",
              specialist:
                current.specialist ?? guidedDefaultSpecialistRef.current,
            }));
            return;
          }
        }
          if (type === "session.info") {
            // The gateway has built the agent and published its durable
            // session. This is a stronger readiness signal than scraping the
            // hidden terminal for a prompt glyph, which can be lost during a
            // server restart or terminal-width reflow.
            markGuidedAgentReady();
            const storedSessionId =
              typeof payload?.stored_session_id === "string"
                ? payload.stored_session_id.trim()
                : "";
            if (storedSessionId && workspaceParam) {
              writeGuidedProjectSessionId(workspaceParam, storedSessionId);
            }
            if (payload?.usage) {
              setGuidedUsage(normalizeGuidedUsage(payload.usage));
            }
            return;
          }
        if (type === "approval.request") {
          setGuidedApproval({
            choices: guidedApprovalChoices({
              allowPermanent: payload?.allow_permanent,
              choices: payload?.choices,
              smartDenied: payload?.smart_denied,
            }),
            command:
              typeof payload?.command === "string" ? payload.command : "",
            description:
              typeof payload?.description === "string"
                ? payload.description
                : "This action needs your approval",
          });
          setGuidedLastSignalAt(Date.now());
          setGuidedActivity((current) => ({
            phase: "working",
            text: "Waiting for your approval…",
            specialist: current.specialist ?? APP_IT_SPECIALIST,
          }));
          return;
        }
        if (type === "message.start") {
          guidedTurnSettledRef.current = false;
          streamedText = "";
          setGuidedLastSignalAt(Date.now());
          setGuidedActivity((current) => ({
            phase: "working",
            text: "Continuing with the next step…",
            specialist:
              current.specialist ?? guidedDefaultSpecialistRef.current,
          }));
          return;
        }
        if (type === "message.delta") {
          if (typeof payload?.text === "string") {
            streamedText += payload.text;
          }
          setGuidedLastSignalAt(Date.now());
          return;
        }
        if (isGuidedModelActivityEvent(type)) {
          setGuidedLastSignalAt(Date.now());
          if (type === "thinking.delta") {
            const waitText =
              typeof payload?.text === "string" ? payload.text.trim() : "";
            if (waitText) {
              setGuidedActivity((current) => ({
                phase: "working",
                text: waitText,
                specialist:
                  current.specialist ?? guidedDefaultSpecialistRef.current,
              }));
            }
          }
          return;
        }
        if (
          type === "tool.start" ||
          type === "tool.progress" ||
          type === "tool.generating" ||
          type === "subagent.spawn_requested" ||
          type === "subagent.start" ||
          type === "subagent.thinking" ||
          type === "subagent.tool" ||
          type === "subagent.progress"
        ) {
          const signal = [
            payload?.name,
            payload?.args_text,
            payload?.goal,
            payload?.context,
            payload?.preview,
            payload?.summary,
            payload?.text,
          ]
            .filter((value): value is string => typeof value === "string")
            .join(" ");
          const detected = analyzeGuidedChatOutput(signal).specialist;
          const selected =
            detected &&
            guidedSelectedSpecialistIdsRef.current.includes(detected.id)
              ? detected
              : null;
          const isSubagent = type.startsWith("subagent.");
          if (isSubagent) {
            // Every genuine phase event pushes the deadline forward, so a live
            // phase is never interrupted — but silence after the last one is
            // bounded, and a bare spawn request buys much less time.
            guidedSubagentGraceUntilRef.current = extendGuidedSubagentGrace(
              guidedSubagentGraceUntilRef.current,
              type,
              Date.now(),
            );
              setGuidedWorkers((current) =>
                updateGuidedWorkers(
                  current,
                  type,
                  {
                    ...payload,
                    display_label:
                      detected?.label ??
                      payload?.display_label ??
                      "Project agent",
                  },
                  Date.now(),
                ),
              );
          }
          const label = friendlyActivityLabel(
            payload as Record<string, unknown> | undefined,
            isSubagent,
          );
          if (!isSubagent) {
            const now = Date.now();
            const toolId =
              typeof payload?.tool_id === "string" && payload.tool_id.trim()
                ? payload.tool_id.trim()
                : "";
            if (type === "tool.start") {
              const id =
                toolId ||
                `${String(payload?.name || "tool")}-${now.toString(36)}`;
              const next = new Map(guidedActiveToolsRef.current);
              next.set(id, {
                deadline: now + GUIDED_TOOL_SILENCE_GRACE_MS,
                id,
                label: label ?? "A project tool is running…",
                name:
                  typeof payload?.name === "string" && payload.name.trim()
                    ? payload.name.trim()
                    : "tool",
                startedAt: now,
              });
              guidedActiveToolsRef.current = next;
              setGuidedRunningTool(latestGuidedRunningTool(next));
            } else if (guidedActiveToolsRef.current.size > 0) {
              // A progress/generating event proves the active tool is alive.
              // Extend matching ids when supplied, otherwise all active calls
              // because some provider adapters emit id-less progress frames.
              const next = new Map(guidedActiveToolsRef.current);
              for (const [id, tool] of next) {
                if (!toolId || id === toolId) {
                  next.set(id, {
                    ...tool,
                    deadline: now + GUIDED_TOOL_SILENCE_GRACE_MS,
                    label: label ?? tool.label,
                  });
                }
              }
              guidedActiveToolsRef.current = next;
              setGuidedRunningTool(latestGuidedRunningTool(next));
            }
          }
          guidedTurnSettledRef.current = false;
          setGuidedLastSignalAt(Date.now());
          setGuidedActivity((current) => ({
            phase: "working",
            text:
              label ??
              (isSubagent
                ? "An agent is working on this phase…"
                : "Preparing the next step…"),
            specialist:
              selected ??
              current.specialist ??
              guidedDefaultSpecialistRef.current,
          }));
          return;
        }
        if (type === "subagent.complete") {
          guidedSubagentGraceUntilRef.current = 0;
          setGuidedLastSignalAt(Date.now());
            const detected = analyzeGuidedChatOutput(
              [payload?.goal, payload?.summary, payload?.text]
                .filter((value): value is string => typeof value === "string")
                .join(" "),
            ).specialist;
            setGuidedWorkers((current) =>
              updateGuidedWorkers(
                current,
                type,
                {
                  ...payload,
                  display_label:
                    detected?.label ??
                    payload?.display_label ??
                    "Project agent",
                },
                Date.now(),
              ),
            );
          return;
        }
        if (type === "tool.complete") {
          const next = new Map(guidedActiveToolsRef.current);
          const toolId =
            typeof payload?.tool_id === "string" ? payload.tool_id.trim() : "";
          if (toolId) {
            next.delete(toolId);
          } else if (typeof payload?.name === "string") {
            for (const [id, tool] of next) {
              if (tool.name === payload.name) next.delete(id);
            }
          }
          guidedActiveToolsRef.current = next;
          setGuidedRunningTool(latestGuidedRunningTool(next));
          setGuidedLastSignalAt(Date.now());
          return;
        }
        if (type === "message.complete") {
          setGuidedApproval(null);
          // A completed parent message is also a definitive boundary for any
          // child phase, even when a provider omitted subagent.complete.
          guidedSubagentGraceUntilRef.current = 0;
          guidedActiveToolsRef.current = new Map();
          setGuidedCompacting(false);
          setGuidedRunningTool(null);
            if (payload?.usage) {
              setGuidedUsage(normalizeGuidedUsage(payload.usage));
            }
            const response = (
              typeof payload?.text === "string" && payload.text.trim()
              ? payload.text
              : streamedText
            ).trim();
          streamedText = "";
          if (response) {
            const teamRecommendation = extractAppItSkillSelection(
              response,
              GUIDED_SELECTABLE_SPECIALIST_IDS,
            );
            finishGuidedResponse(response);
            // A declared [APP_IT_PHASE_DONE:...] is the reliable signal; the
            // prose test stays as a fallback for replies without markers.
            const advanceTo = guidedPhaseAdvanceRef.current;
            guidedPhaseAdvanceRef.current = null;
            if (
              shouldAutoContinueGuidedWorkflow({
                awaitingTeamConfirmation: Boolean(teamRecommendation),
                hasDeclaredNextPhase: Boolean(advanceTo),
                response,
              })
            ) {
              const nextAttempt = guidedAutoContinueCountRef.current + 1;
              guidedAutoContinueCountRef.current = nextAttempt;
              if (nextAttempt > 24) {
                appendGuidedError(
                  "The workflow paused after too many automatic handoffs. Send “continue” to resume from the current phase.",
                );
                return;
              }
              guidedTurnSettledRef.current = false;
              setGuidedLastSignalAt(Date.now());
              const advanceLabel = advanceTo
                  ? (GUIDED_SPECIALIST_LABELS[advanceTo] ?? advanceTo)
                : null;
              setGuidedActivity((current) => ({
                phase: "working",
                // Narrow on advanceTo itself: TypeScript cannot carry the
                // null-check across from advanceLabel into this closure.
                text: advanceTo
                    ? `Handing over to ${guidedAgentName(advanceTo, advanceLabel ?? undefined)}…`
                  : "Moving to the promised agent…",
                specialist: advanceTo
                  ? { id: advanceTo, label: advanceLabel ?? advanceTo }
                    : (current.specialist ??
                      guidedDefaultSpecialistRef.current),
              }));
              window.setTimeout(() => {
                const active = wsRef.current;
                if (!active || active.readyState !== WebSocket.OPEN) return;
                guidedTurnStartLineRef.current = Math.max(
                  0,
                  (termRef.current?.buffer.active.length ?? 1) - 1,
                );
                lastGuidedResponseRef.current = "";
                writeGuidedPrompt(
                  `${guidedPlainLanguageTurnDirective()}\n${advanceTo
                    ? `IDRAK_INTERNAL_CONTINUE: Start the ${advanceLabel} phase now. Load skill_view(name="ultimate-builder:${advanceTo}"), emit [APP_IT_PHASE:${advanceTo}] in your next reply, run or delegate that phase, verify its artifact, then emit [APP_IT_PHASE_DONE:${advanceTo}] and continue with the next enabled phase. Do not merely describe the next action. Stop for: any approval checkpoint (requirements summary, visual preview, final delivery), a real user decision, permission request, blocker, or final completion. At approval checkpoints, present options (Approve / Change / Skip) and wait.`
                    : "IDRAK_INTERNAL_CONTINUE: Continue the selected workflow now. Perform the promised tool call or specialist delegation, verify its artifact, and then advance through later enabled phases. Do not merely describe the next action. Stop for: any approval checkpoint (requirements summary, visual preview, final delivery), a real user decision, permission request, blocker, or final completion. At approval checkpoints, present options (Approve / Change / Skip) and wait."}`,
                  {
                    isOpen: () =>
                      wsRef.current?.readyState === WebSocket.OPEN,
                    schedule: (run, delayMs) =>
                      window.setTimeout(run, delayMs),
                    send: (data) => active.send(data),
                  },
                );
              }, 350);
            }
          } else if (payload?.failure_reason) {
            guidedTurnSettledRef.current = true;
            appendGuidedError(
              `The AI model could not finish this response: ${payload.failure_reason}`,
            );
            setGuidedActivity({
              phase: "idle",
              text: "",
              specialist: null,
            });
          } else {
            guidedTurnSettledRef.current = true;
            setGuidedActivity({
              phase: "idle",
              text: "",
              specialist: null,
            });
          }
          return;
        }
        if (type === "error" && payload?.message) {
          setGuidedApproval(null);
          guidedSubagentGraceUntilRef.current = 0;
          guidedActiveToolsRef.current = new Map();
          setGuidedRunningTool(null);
          guidedTurnSettledRef.current = true;
          appendGuidedError(payload.message);
          setGuidedActivity({
            phase: "idle",
            text: "",
            specialist: null,
          });
        }
      });
      } catch {
        guidedStructuredFeedConnectedRef.current = false;
        scheduleReconnect();
      }
    };

    void connect();

    return () => {
      unmounting = true;
      guidedStructuredFeedConnectedRef.current = false;
      if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, [
    appendGuidedError,
    channel,
    finishGuidedResponse,
    guided,
    guidedSessionLookupComplete,
    hasActivated,
    markGuidedAgentReady,
    workspaceParam,
  ]);

  useEffect(() => {
    if (!isActive) {
      setTitle(null);
      return;
    }

    setTitle(sessionTitle);
    return () => setTitle(null);
  }, [isActive, sessionTitle, setTitle]);

  useEffect(() => {
    if (!resumeParam) return;

    let cancelled = false;

    api
      .getSessionDetail(resumeParam, scopedProfile)
      .then((session) => {
        if (cancelled) return;
        handleSessionTitleChange(normalizeSessionTitle(session.title));
      })
      .catch(() => {
        // Best-effort: the PTY-side session.info stream can still supply it.
      });

    return () => {
      cancelled = true;
    };
  }, [resumeParam, scopedProfile, handleSessionTitleChange]);

  useEffect(() => {
    if (!resumeParam) return;

    let cancelled = false;

    api
      .getSessionLatestDescendant(resumeParam, scopedProfile)
      .then((res) => {
        if (cancelled || !res.session_id || res.session_id === resumeParam) {
          return;
        }

        const next = new URLSearchParams(searchParams);
        next.set("resume", res.session_id);
        setSearchParams(next, { replace: true });
      })
      .catch(() => {
        // Best-effort: old servers or missing sessions should not block chat.
      });

    return () => {
      cancelled = true;
    };
  }, [resumeParam, scopedProfile, searchParams, setSearchParams]);

  useEffect(() => {
    const mql = window.matchMedia("(max-width: 1023px)");
    const sync = () => setNarrow(mql.matches);
    sync();
    mql.addEventListener("change", sync);
    return () => mql.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!mobilePanelOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMobilePanel();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [mobilePanelOpen, closeMobilePanel]);

  useEffect(() => {
    if (!guidedSkillsOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setGuidedSkillsOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [guidedSkillsOpen]);

  useEffect(() => {
    const mql = window.matchMedia("(min-width: 1024px)");
    const onChange = (e: MediaQueryListEvent) => {
      if (e.matches) setMobilePanelOpenRaw(false);
    };
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    // When hidden (non-chat tab) we must not register the header button —
    // another page owns the header's end slot at that point.
    if (!isActive) {
      setEnd(null);
      return;
    }
    if (!narrow || guided) {
      setEnd(null);
      return;
    }
    setEnd(
      <Button
        ghost
        onClick={() => setMobilePanelOpenRaw(true)}
        aria-expanded={mobilePanelOpen}
        aria-controls="chat-side-panel"
        className={cn(
          "shrink-0 rounded border border-current/20",
          "px-2 py-1 text-xs font-medium tracking-wide",
          "text-text-secondary hover:text-midground hover:bg-midground/5",
        )}
      >
        <span className="inline-flex items-center gap-1.5">
          <PanelRight className="h-3 w-3 shrink-0" />
          {modelToolsLabel}
        </span>
      </Button>,
    );
    return () => setEnd(null);
  }, [guided, isActive, narrow, mobilePanelOpen, modelToolsLabel, setEnd]);

  const submitGuidedText = useCallback(
    (
      value: string,
      displayValue?: string,
      options: { applyAgentRouting?: boolean } = {},
    ) => {
    const text = value.trim();
    const ws = wsRef.current;
    const modelReview = guidedModelReviewRef.current;
    if (modelReview) {
      setGuidedTeamRecommendationPending(false);
      setGuidedRecommendedSpecialistIds([]);
      setGuidedSkillDraftIds(
        withRequiredGuidedSpecialists(
          guidedSelectedSpecialistIdsRef.current,
          GUIDED_SELECTABLE_SPECIALIST_IDS,
        ),
      );
      setGuidedSkillModelDraft({ ...guidedSkillModelsRef.current });
      setGuidedSkillsOpen(true);
      setBanner(
        `Choose replacement agent models for ${modelReview.provider} before continuing.`,
      );
      return;
    }
    if (
      !guidedAgentReadyRef.current ||
      !text ||
      !ws ||
      ws.readyState !== WebSocket.OPEN
    ) {
      return;
    }
    guidedTurnStartLineRef.current = Math.max(
      0,
      (termRef.current?.buffer.active.length ?? 1) - 1,
    );
    guidedAutoScrollRef.current = true;
    guidedTurnSettledRef.current = false;
    guidedSubagentGraceUntilRef.current = 0;
    guidedActiveToolsRef.current = new Map();
    setGuidedCompacting(false);
    setGuidedRunningTool(null);
    guidedAutoContinueCountRef.current = 0;
    lastGuidedResponseRef.current = "";
    setGuidedLastSignalAt(Date.now());
    setGuidedMessages((messages) => [
      ...messages,
      {
        id: `user-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        role: "user",
        content: displayValue?.trim() || text,
      },
    ]);
    setGuidedActivity({
      phase: "working",
      text: "Let me think…",
      specialist: guidedDefaultSpecialistRef.current,
    });
    setGuidedOutput("");
    const routing: string[] = [guidedPlainLanguageTurnDirective()];
    if (options.applyAgentRouting !== false) {
      routing.push(
        guidedRequirementsTurnDirective({
          completed: guidedPhasesCompletedRef.current,
          current: guidedPhaseCurrentRef.current,
        }),
      );
    }
    const routedText = [...routing, text].filter(Boolean).join("\n");
    // Bracketed paste, not raw typing: a multi-line prompt written straight to
    // the PTY submits at its first newline, so only the opening line became the
    // turn and the rest arrived as interruptions mid-answer.
    writeGuidedPrompt(routedText, {
      isOpen: () => wsRef.current?.readyState === WebSocket.OPEN,
      schedule: (run, delayMs) => window.setTimeout(run, delayMs),
      send: (data) => ws.send(data),
    });
    setGuidedInput("");
    },
    [],
  );

  const respondToGuidedApproval = useCallback(
    (choice: GuidedApprovalChoice) => {
      const request = guidedApproval;
      const socket = wsRef.current;
      if (!request || !socket || socket.readyState !== WebSocket.OPEN) return;
      const key = guidedApprovalKey(request.choices, choice);
      if (!key) return;
      // The approval overlay lives in the real Ink TUI running inside this PTY.
      // Its numbered choices are the transport contract; forwarding the key
      // resolves the exact pending request even for profile-scoped gateways.
      socket.send(key);
      setGuidedApproval(null);
      setGuidedLastSignalAt(Date.now());
      setGuidedActivity((current) => ({
        phase: "working",
        text: choice === "deny" ? "Stopping that action…" : "Continuing…",
        specialist: current.specialist ?? APP_IT_SPECIALIST,
      }));
    },
    [guidedApproval],
  );

  const sendGuidedProjectState = useCallback(
    (
      specialists: readonly string[],
      models: Readonly<Record<string, string>>,
      displayValue: string,
    ) => {
      const labels = specialists.map(
        (skillId) => GUIDED_SPECIALIST_LABELS[skillId],
      );
      const payload = `IDRAK_INTERNAL_SKILLS_UPDATE_BEGIN ${JSON.stringify({
        enabled_specialists: specialists,
        enabled_specialist_labels: labels,
        specialist_models: models,
      })} IDRAK_INTERNAL_SKILLS_UPDATE_END`;
      submitGuidedText(payload, displayValue, { applyAgentRouting: false });
    },
    [submitGuidedText],
  );

  const openGuidedSkills = useCallback(() => {
    setGuidedTeamRecommendationPending(false);
    setGuidedRecommendedSpecialistIds([]);
    setGuidedSkillDraftIds(
      withRequiredGuidedSpecialists(
        guidedSelectedSpecialistIdsRef.current,
        GUIDED_SELECTABLE_SPECIALIST_IDS,
      ),
    );
    setGuidedSkillModelDraft({ ...guidedSkillModelsRef.current });
    setGuidedSkillsOpen(true);
  }, []);

  const toggleGuidedSpecialistDraft = useCallback((id: string) => {
      if (!GUIDED_SELECTABLE_SPECIALIST_IDS.includes(id)) return;
      // Requirements is not optional — see guided-required-specialists.ts.
      if (isRequiredGuidedSpecialist(id)) return;
      setGuidedSkillDraftIds((current) =>
        current.includes(id)
          ? current.filter((candidate) => candidate !== id)
          : [...current, id],
      );
  }, []);

  const updateGuidedSpecialistModelDraft = useCallback(
    (id: string, model: string) => {
      if (!GUIDED_SELECTABLE_SPECIALIST_IDS.includes(id)) return;
      setGuidedSkillModelDraft((current) => {
        const next = { ...current };
        if (model.trim()) next[id] = model.trim();
        else delete next[id];
        return next;
      });
    },
    [],
  );

  const saveGuidedSkills = useCallback(() => {
    if (
      !guidedAgentReadyRef.current ||
      wsRef.current?.readyState !== WebSocket.OPEN
    ) {
      return;
    }
    const selected = withRequiredGuidedSpecialists(
      GUIDED_SELECTABLE_SPECIALIST_IDS.filter((id) =>
        guidedSkillDraftIds.includes(id),
      ),
      GUIDED_SELECTABLE_SPECIALIST_IDS,
    );
    const models = Object.fromEntries(
      Object.entries(guidedSkillModelDraft).filter(
        ([id, model]) =>
          selected.includes(id) &&
          Boolean(model.trim()),
      ),
    );
    const unavailable = unavailableGuidedModelAssignments(
      models,
      selected,
      guidedModelOptions,
    );
    if (unavailable.length) {
      const review = guidedModelReviewRef.current;
      setBanner(
        `Choose a current ${review?.provider || "provider"} model, or explicitly choose Follow project model, for every highlighted agent.`,
      );
      return;
    }
    applyGuidedSpecialistIds(selected);
    guidedSkillModelsRef.current = models;
    setGuidedSkillModels(models);
    guidedModelReviewRef.current = null;
    setGuidedModelReview(null);
    try {
      window.localStorage.setItem(
        GUIDED_SKILL_MODELS_STORAGE_KEY,
        JSON.stringify(models),
      );
    } catch {
      // Live routing still works for this conversation.
    }
    const labels = selected.map((id) => GUIDED_SPECIALIST_LABELS[id]);
    sendGuidedProjectState(
      selected,
      models,
      labels.length
        ? `Updated project agents: ${labels.join(", ")}`
        : "Updated project agents: Lyra only",
    );
    setGuidedTeamRecommendationPending(false);
    setGuidedRecommendedSpecialistIds([]);
    setGuidedSkillsOpen(false);
  }, [
    applyGuidedSpecialistIds,
    guidedSkillDraftIds,
    guidedSkillModelDraft,
    guidedModelOptions,
    sendGuidedProjectState,
  ]);

  const addGuidedAttachments = useCallback(
    (incoming: readonly File[]) => {
      if (!incoming.length) return;
      // What the model cannot accept never reaches the upload: a file on disk
      // plus an answer written as if it had been read is worse than a refusal.
      const screened = screenAttachments(incoming, guidedModelCaps);
      const tooBig = screened.accepted
        .map((file) => attachmentRejection(file))
        .filter((reason): reason is string => Boolean(reason));
      const accepted = screened.accepted.filter(
        (file) => !attachmentRejection(file),
      );
      const problems = [...screened.refusals, ...tooBig];
      if (problems.length) appendGuidedError(problems.join("\n"));
      if (accepted.length) {
        setGuidedAttachments((current) => mergeAttachments(current, accepted));
      }
    },
    [appendGuidedError, guidedModelCaps],
  );

  const removeGuidedAttachment = useCallback((index: number) => {
    setGuidedAttachments((current) =>
      current.filter((_file, position) => position !== index),
    );
  }, []);

  /**
   * Upload the attachments, then send the message.
   *
   * Images go through the TUI's `/image <path>` command so they arrive as vision
   * content on the turn; documents are uploaded and their absolute paths are
   * appended to the prompt for the agent's file tools to open. The visible
   * bubble shows the typed text plus a 📎 line, never the paths.
   */
  const sendGuidedMessage = useCallback(() => {
    const text = guidedInput.trim();
    const attachments = guidedAttachments;
    if (!attachments.length) {
      submitGuidedText(guidedInput);
      return;
    }
    if (guidedAttachBusy) return;

    // Re-checked here as well: the model can be switched between picking a file
    // and sending it.
    const screened = screenAttachments(attachments, guidedModelCaps);
    if (screened.refusals.length) {
      appendGuidedError(screened.refusals.join("\n"));
      setGuidedAttachments(screened.accepted);
      return;
    }

    const { documents, images } = splitChatAttachments(attachments);
    setGuidedAttachBusy(true);
    void (async () => {
      const uploads: ChatFileUploadResult[] = [];
      for (const file of documents) {
        uploads.push(await uploadChatFile(file, scopedProfile));
      }
      const imagePaths: string[] = [];
      for (const file of images) {
        const uploaded = await uploadChatImage(file, scopedProfile);
        imagePaths.push(uploaded.path);
      }

      const socket = wsRef.current;
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        appendGuidedError(
          "Attachments uploaded, but the chat is not connected — try sending again.",
        );
        return;
      }

      // Attach images first: /image is a composer command, so it has to land
      // and be submitted before the message text is typed.
      for (const path of imagePaths) {
        socket.send(`/image ${path}`);
        await new Promise<void>((resolve) => window.setTimeout(resolve, 120));
        if (wsRef.current?.readyState !== WebSocket.OPEN) return;
        wsRef.current.send("\r");
        await new Promise<void>((resolve) => window.setTimeout(resolve, 160));
      }
      if (wsRef.current?.readyState !== WebSocket.OPEN) return;

      const summary = attachmentSummaryLine(attachments);
      const prompt = `${text}${attachmentPromptBlock(uploads)}`.trim();
      setGuidedAttachments([]);
      submitGuidedText(
        prompt || summary,
        [text, summary].filter(Boolean).join("\n"),
      );
    })()
      .catch((error: unknown) => {
        appendGuidedError(
          `Attachment upload failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      })
      .finally(() => setGuidedAttachBusy(false));
  }, [
    appendGuidedError,
    guidedAttachBusy,
    guidedAttachments,
    guidedInput,
    guidedModelCaps,
    scopedProfile,
    submitGuidedText,
  ]);

  const sendGuidedControlCommand = useCallback((command: string) => {
    const socket = wsRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return false;
    writeGuidedPrompt(command, {
      isOpen: () => wsRef.current?.readyState === WebSocket.OPEN,
      schedule: (run, delayMs) => window.setTimeout(run, delayMs),
      send: (data) => socket.send(data),
    });
    return true;
  }, []);

  const toggleGuidedPause = useCallback(() => {
    const nextPaused = !guidedPaused;
    if (
      !sendGuidedControlCommand(nextPaused ? "/agents pause" : "/agents resume")
    ) {
      appendGuidedError(
        "Worker controls are unavailable while the chat reconnects.",
      );
      return;
    }
      guidedSubagentGraceUntilRef.current = 0;
    if (nextPaused) {
      setGuidedWorkers((current) => markGuidedWorkerStopping(current));
    }
    setGuidedPaused(nextPaused);
  }, [appendGuidedError, guidedPaused, sendGuidedControlCommand]);

  const stopGuidedWorkers = useCallback(
    (subagentId?: string) => {
      const command = subagentId
        ? `/agents stop ${subagentId}`
        : "/agents stop";
      if (!sendGuidedControlCommand(command)) {
        appendGuidedError(
          "Worker controls are unavailable while the chat reconnects.",
        );
        return;
    }
      setGuidedWorkers((current) =>
        markGuidedWorkerStopping(current, subagentId),
      );
    },
    [appendGuidedError, sendGuidedControlCommand],
  );

  const continueGuidedOnTelegram = useCallback(() => {
    if (telegramReadiness !== "ready") {
      const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      window.location.href = `/channels?focus=telegram&returnTo=${encodeURIComponent(returnTo)}`;
      return;
    }

    const socket = wsRef.current;
    if (
      !socket ||
      socket.readyState !== WebSocket.OPEN ||
      guidedActivity.phase === "working" ||
      !guidedAgentReadyRef.current
    ) {
      appendGuidedError(
        "Wait for Lyra to finish the current step, then try Continue on Telegram again.",
      );
      return;
    }

    telegramHandoffRequestedRef.current = true;
    setTelegramHandoffStatus("sending");
    writeGuidedPrompt("/handoff telegram", {
      isOpen: () => wsRef.current?.readyState === WebSocket.OPEN,
      schedule: (run, delayMs) => window.setTimeout(run, delayMs),
      send: (data) => socket.send(data),
    });

    // The gateway watcher has a bounded 60-second handoff window. If the PTY
    // has not exited by then, leave the project local and offer a retry rather
    // than showing an endless "moving" state.
    window.setTimeout(() => {
      if (!telegramHandoffRequestedRef.current) return;
      telegramHandoffRequestedRef.current = false;
      setTelegramHandoffStatus("failed");
    }, 65_000);
  }, [appendGuidedError, guidedActivity.phase, telegramReadiness]);

  const retryLastGuidedMessage = useCallback(() => {
    const ws = wsRef.current;
    const lastUserMessage = [...guidedMessages]
      .reverse()
      .find((message) => message.role === "user");
    const lastAssistantMessage = [...guidedMessages]
      .reverse()
      .find((message) => message.role === "assistant");
    if (!lastUserMessage || !ws || ws.readyState !== WebSocket.OPEN) {
      return;
    }

    ws.send("\x03");
    setGuidedPaused(false);
    guidedAutoScrollRef.current = true;
    guidedTurnSettledRef.current = false;
    guidedTurnStartLineRef.current = Math.max(
      0,
      (termRef.current?.buffer.active.length ?? 1) - 1,
    );
    lastGuidedResponseRef.current = "";
    guidedActiveToolsRef.current = new Map();
    setGuidedCompacting(false);
    setGuidedRunningTool(null);
    setGuidedOutput("");
    setGuidedLastSignalAt(Date.now());
    setGuidedMessages((messages) =>
      messages[messages.length - 1]?.role === "error"
        ? messages.slice(0, -1)
        : messages,
    );
    const inferred = lastAssistantMessage
      ? analyzeGuidedChatOutput(lastAssistantMessage.content).specialist
      : null;
    setGuidedActivity({
      phase: "working",
      text: "Trying that again…",
      specialist:
        inferred && guidedSelectedSpecialistIdsRef.current.includes(inferred.id)
          ? inferred
          : guidedDefaultSpecialistRef.current,
    });

    window.setTimeout(() => {
      const active = wsRef.current;
      if (!active || active.readyState !== WebSocket.OPEN) return;
      writeGuidedPrompt(
        `${guidedPlainLanguageTurnDirective()}\n${lastUserMessage.content}`,
        {
        isOpen: () => wsRef.current?.readyState === WebSocket.OPEN,
        schedule: (run, delayMs) => window.setTimeout(run, delayMs),
        send: (data) => active.send(data),
        },
      );
    }, 300);
  }, [guidedMessages]);

  const handleCopyLast = () => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    // Send the slash as a burst, wait long enough for Ink's tokenizer to
    // emit a keypress event for each character (not coalesce them into a
    // paste), then send Return as its own event.  The timing here is
    // empirical — 100ms is safely past Node's default stdin coalescing
    // window and well inside UI responsiveness.
    ws.send("/copy");
    setTimeout(() => {
      const s = wsRef.current;
      if (s && s.readyState === WebSocket.OPEN) s.send("\r");
    }, 100);
    setCopyState("copied");
    if (copyResetRef.current) clearTimeout(copyResetRef.current);
    copyResetRef.current = setTimeout(() => setCopyState("idle"), 1500);
    termRef.current?.focus();
  };

  useEffect(() => {
    // Don't spawn the chat PTY (and the TUI/agent bootstrap it triggers)
    // until the chat tab has been activated. Prevents the persistently
    // mounted, hidden ChatPage from opening `/api/pty` on every dashboard
    // page. Sticky, so switching away from /chat keeps the PTY alive.
    if (!hasActivated || !guidedSessionLookupComplete) return;

    const host = hostRef.current;
    if (!host) return;

    const token = window.__IDRAK_IT_SESSION_TOKEN__;
    const gated = !!window.__IDRAK_IT_AUTH_REQUIRED__;
    // Banner already initialised above; just bail before wiring xterm/WS.
    // In gated mode the token is absent by design — api.buildWsUrl() mints
    // a WS ticket instead, so don't bail; let the effect reach that path.
    if (!token && !gated) {
      return;
    }

    const tierW0 = terminalTierWidthPx(host);
    const term = new Terminal({
      allowProposedApi: true,
      cursorBlink: true,
      fontFamily:
        "'JetBrains Mono', 'Cascadia Mono', 'Fira Code', 'MesloLGS NF', 'Source Code Pro', Menlo, Consolas, 'DejaVu Sans Mono', monospace",
      fontSize: terminalFontSizeForWidth(tierW0),
      lineHeight: terminalLineHeightForWidth(tierW0),
      letterSpacing: 0,
      fontWeight: "400",
      fontWeightBold: "700",
      macOptionIsMeta: true,
      // Hold Option (Alt on Linux/Windows) to force native text selection
      // even when the inner Hermes TUI has enabled xterm mouse-events
      // mode (CSI ?1000h family). Without this, click-and-drag in the
      // chat canvas selects nothing and Cmd+C falls back to copying the
      // entire visible buffer, which is rarely what the user wants.
      // See #25720.
      macOptionClickForcesSelection: true,
      // Right-click selects the word under the pointer. xterm.js default
      // is false; enabling it gives users a single-action selection
      // path on top of the modifier-based bypass above.
      rightClickSelectsWord: true,
      // Browser-embedded chat runs the TUI in inline mode. Keep transcript
      // history in xterm.js so the browser wheel can scroll it directly.
      scrollback: 5000,
      theme: terminalTheme,
    });
    termRef.current = term;

    // --- Clipboard integration ---------------------------------------
    //
    // Four independent paths all route to the system clipboard:
    //
    //   1. **Selection → Ctrl+C (or Cmd+C on macOS).**  Ink's own handler
    //      in useInputHandlers.ts turns Ctrl+C into a copy when the
    //      terminal has a selection, then emits an OSC 52 escape.  Our
    //      OSC 52 handler below decodes that escape and writes to the
    //      browser clipboard — so the flow works just like it does in
    //      `hermes --tui`.
    //
    //   2. **Ctrl/Cmd+Shift+C.**  Belt-and-suspenders shortcut that
    //      operates directly on xterm's selection, useful if the TUI
    //      ever stops listening (e.g. overlays / pickers) or if the user
    //      has selected with the mouse outside of Ink's selection model.
    //
    //   3. **Ctrl/Cmd+Shift+V.**  Prefers clipboard.read() for images
    //      (upload → `/image`), else readText() into term.paste().
    //      preventDefault here suppresses the DOM paste event, so image
    //      handling must live in this key path — not only the host
    //      listener below.
    //
    //   4. **DOM paste / drop on the host.**  Bare Ctrl+V and context-menu
    //      paste fire a ClipboardEvent; drag-drop lands files. Image
    //      payloads upload to HERMES_HOME/images then drive `/image`.
    //
    // OSC 52 reads (terminal asking to read the clipboard) are not
    // supported — that would let any content the TUI renders exfiltrate
    // the user's clipboard.
    term.parser.registerOscHandler(52, (data) => {
      // Format: "<targets>;<base64 | '?'>"
      const semi = data.indexOf(";");
      if (semi < 0) return false;
      const payload = data.slice(semi + 1);
      if (payload === "?" || payload === "") return false; // read/clear — ignore
      try {
        const binary = atob(payload);
        const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
        const text = new TextDecoder("utf-8").decode(bytes);
        navigator.clipboard.writeText(text).catch((err) => {
          // Most common reason: the Clipboard API requires a user gesture.
          // This can fail when the OSC 52 response arrives outside the
          // original keydown event's activation. Log to aid debugging.
          console.warn(
            "[dashboard clipboard] OSC 52 write failed:",
            err.message,
          );
        });
      } catch {
        console.warn("[dashboard clipboard] malformed OSC 52 payload");
      }
      return true;
    });

    const isMac =
      typeof navigator !== "undefined" && /Mac/i.test(navigator.platform);

    // ── Image paste / drop ───────────────────────────────────────────────
    // The Chat tab is an xterm mirror of a TUI inside the gateway. Server-side
    // clipboard.paste / xclip never see the browser clipboard, so image paste
    // must upload browser bytes to HERMES_HOME/images, then drive `/image`
    // over the PTY (same burst-then-Return timing as handleCopyLast).
    let imageUploadDisposed = false;
    const pasteDelay = () =>
      new Promise<void>((resolve) => window.setTimeout(resolve, 40));
    const reportImageUploadError = (err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      console.warn("[dashboard chat] image upload failed:", message);
      setBanner(`Image upload failed: ${message}`);
    };
    const driveImageAttach = async (paths: string[]) => {
      for (const path of paths) {
        if (imageUploadDisposed) return;
        const ws = wsRef.current;
        if (!ws || ws.readyState !== WebSocket.OPEN) {
          setBanner("Image uploaded, but chat is not connected — try again.");
          return;
        }
        ws.send(`/image ${path}`);
        await new Promise<void>((resolve) => window.setTimeout(resolve, 100));
        const s = wsRef.current;
        if (!s || s.readyState !== WebSocket.OPEN) return;
        s.send("\r");
        await pasteDelay();
      }
      term.focus();
    };
    const uploadAndAttachImages = (files: File[]) => {
      if (!files.length) return;
      void (async () => {
        const paths: string[] = [];
        for (const file of files) {
          const uploaded = await uploadChatImage(file, scopedProfile);
          if (imageUploadDisposed) return;
          paths.push(uploaded.path);
        }
        await driveImageAttach(paths);
      })().catch(reportImageUploadError);
    };
    const handleBrowserPaste = (ev: ClipboardEvent) => {
      const files = imageFilesFromTransfer(ev.clipboardData);
      if (!files.length) return;
      ev.preventDefault();
      ev.stopPropagation();
      uploadAndAttachImages(files);
    };
    const handleBrowserDragOver = (ev: DragEvent) => {
      if (!transferMayContainImage(ev.dataTransfer)) return;
      ev.preventDefault();
      if (ev.dataTransfer) ev.dataTransfer.dropEffect = "copy";
    };
    const handleBrowserDrop = (ev: DragEvent) => {
      const files = imageFilesFromTransfer(ev.dataTransfer);
      if (!files.length) return;
      ev.preventDefault();
      ev.stopPropagation();
      uploadAndAttachImages(files);
    };
    host.addEventListener("paste", handleBrowserPaste, { capture: true });
    host.addEventListener("dragover", handleBrowserDragOver, { capture: true });
    host.addEventListener("drop", handleBrowserDrop, { capture: true });

    term.attachCustomKeyEventHandler((ev) => {
      if (ev.type !== "keydown") return true;

      // Copy: Cmd+C on macOS, Ctrl+Shift+C on other platforms. Bare Ctrl+C
      // is reserved for SIGINT to the TUI child — matches xterm / gnome-terminal /
      // konsole / Windows Terminal. Ctrl+Shift+C only copies if a selection exists;
      // without a selection it passes through to the TUI so agents can still
      // react to the keypress.
      // Paste: Cmd+Shift+V on macOS, Ctrl+Shift+V on others.
      const copyModifier = isMac ? ev.metaKey : ev.ctrlKey && ev.shiftKey;
      const pasteModifier = isMac ? ev.metaKey : ev.ctrlKey && ev.shiftKey;

      if (copyModifier && ev.key.toLowerCase() === "c") {
        const sel = term.getSelection();
        if (sel) {
          // Direct writeText inside the keydown handler preserves the user
          // gesture — async round-trips through OSC 52 can lose activation
          // and fail with "Document is not focused".
          navigator.clipboard.writeText(sel).catch((err) => {
            console.warn(
              "[dashboard clipboard] direct copy failed:",
              err.message,
            );
          });
          // Clear xterm.js's highlight after copy (matches gnome-terminal).
          term.clearSelection();
          ev.preventDefault();
          return false;
        }
        // No selection → fall through so the TUI receives Ctrl+Shift+C
        // (or the bare ev if the user used a different modifier).
      }

      if (pasteModifier && ev.key.toLowerCase() === "v") {
        // preventDefault suppresses the DOM paste event, so image paste must
        // be handled here via clipboard.read() — readText() alone misses
        // image-only clipboards (the Discord / #24860 failure mode).
        ev.preventDefault();
        void (async () => {
          try {
            const read = navigator.clipboard?.read;
            if (typeof read === "function") {
              const items = await read.call(navigator.clipboard);
              const files: File[] = [];
              for (const item of items) {
                const type = item.types.find((t) => t.startsWith("image/"));
                if (!type) continue;
                const blob = await item.getType(type);
                const ext = type.split("/")[1]?.split("+")[0] || "png";
                files.push(new File([blob], `clipboard.${ext}`, { type }));
              }
              if (files.length) {
                uploadAndAttachImages(files);
                return;
              }
            }
          } catch {
            /* fall through to text paste */
          }
          try {
            const text = await navigator.clipboard.readText();
            if (text) term.paste(text);
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            console.warn("[dashboard clipboard] paste failed:", message);
          }
        })();
        return false;
      }

      return true;
    });

    const fit = new FitAddon();
    fitRef.current = fit;
    term.loadAddon(fit);

    // Dashboard chat should scroll the browser-side transcript, not send
    // mouse-wheel protocol bytes through the PTY.
    term.attachCustomWheelEventHandler((ev) => {
      const delta = ev.deltaY;
      if (!delta) {
        return false;
      }

      const step = Math.max(1, Math.round(Math.abs(delta) / 50));
      term.scrollLines(delta > 0 ? step : -step);

      ev.preventDefault();
      ev.stopPropagation();
      return false;
    });

    const unicode11 = new Unicode11Addon();
    term.loadAddon(unicode11);
    term.unicode.activeVersion = "11";

    term.loadAddon(new WebLinksAddon());

    let mobileInputCleanup: (() => void) | null = null;
    term.open(host);

    const textarea = term.textarea;
    if (textarea) {
      textarea.setAttribute("autocomplete", "off");
      textarea.setAttribute("autocorrect", "off");
      textarea.setAttribute("autocapitalize", "off");
      textarea.setAttribute("spellcheck", "false");

      const isMobileLike =
        typeof navigator !== "undefined" &&
        /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
      const markReplacementInput = (ev: Event) => {
        const input = ev as InputEvent;
        if (
          shouldTreatInputAsMobileReplacement(
            input.inputType,
            input.data,
            isMobileLike,
          )
        ) {
          mobileReplacementInputUntilRef.current =
            Date.now() + MOBILE_REPLACEMENT_WINDOW_MS;
        }
      };
      const markCompositionEnd = () => {
        mobileReplacementInputUntilRef.current =
          Date.now() + MOBILE_REPLACEMENT_WINDOW_MS;
      };

      textarea.addEventListener("beforeinput", markReplacementInput, true);
      textarea.addEventListener("compositionend", markCompositionEnd, true);
      mobileInputCleanup = () => {
        textarea.removeEventListener("beforeinput", markReplacementInput, true);
        textarea.removeEventListener(
          "compositionend",
          markCompositionEnd,
          true,
        );
      };
    }

    // WebGL draws from a texture atlas sized with device pixels. On phones and
    // in DevTools device mode that often produces *visually* much larger cells
    // than `fontSize` suggests — users see "huge" text even at 7–9px settings.
    // The canvas/DOM renderer tracks `fontSize` faithfully; use it for narrow
    // hosts.  Wide layouts still get WebGL for crisp box-drawing.
    const useWebgl = terminalTierWidthPx(host) >= 768;
    if (useWebgl) {
      try {
        const webgl = new WebglAddon();
        webgl.onContextLoss(() => webgl.dispose());
        term.loadAddon(webgl);
      } catch (err) {
        console.warn(
          "[hermes-chat] WebGL renderer unavailable; falling back to default",
          err,
        );
      }
    }

    // Initial fit + resize observer.  fit.fit() reads the container's
    // current bounding box and resizes the terminal grid to match.
    //
    // The subtle bit: the dashboard has CSS transitions on the container
    // (backdrop fade-in, rounded corners settling as fonts load).  If we
    // call fit() at mount time, the bounding box we measure is often 1-2
    // cell widths off from the final size.  ResizeObserver *does* fire
    // when the container settles, but if the pixel delta happens to be
    // smaller than one cell's width, fit() computes the same integer
    // (cols, rows) as before and doesn't emit onResize — so the PTY
    // never learns the final size.  Users see truncated long lines until
    // they resize the browser window.
    //
    // We force one extra fit + explicit RESIZE send after two animation
    // frames.  rAF→rAF guarantees one layout commit between the two
    // callbacks, giving CSS transitions and font metrics time to finalize
    // before we take the authoritative measurement.
    let hostSyncRaf = 0;
    const scheduleHostSync = () => {
      if (hostSyncRaf) return;
      hostSyncRaf = requestAnimationFrame(() => {
        hostSyncRaf = 0;
        syncTerminalMetrics();
      });
    };

    let metricsDebounce: ReturnType<typeof setTimeout> | null = null;
    const syncTerminalMetrics = () => {
      // display:none hosts have clientWidth/Height = 0, which fit() turns
      // into a 1x1 terminal.  Skip entirely while hidden; the visibility
      // effect below runs another fit as soon as the tab is shown again.
      if (
        !host.isConnected ||
        host.clientWidth <= 0 ||
        host.clientHeight <= 0
      ) {
        return;
      }
      const w = terminalTierWidthPx(host);
      const nextSize = terminalFontSizeForWidth(w);
      const nextLh = terminalLineHeightForWidth(w);
      const fontChanged =
        term.options.fontSize !== nextSize ||
        term.options.lineHeight !== nextLh;
      if (fontChanged) {
        term.options.fontSize = nextSize;
        term.options.lineHeight = nextLh;
      }
      try {
        fit.fit();
      } catch {
        return;
      }
      if (fontChanged && term.rows > 0) {
        try {
          term.refresh(0, term.rows - 1);
        } catch {
          /* ignore */
        }
      }
      if (
        fontChanged &&
        wsRef.current &&
        wsRef.current.readyState === WebSocket.OPEN
      ) {
        wsRef.current.send(`\x1b[RESIZE:${term.cols};${term.rows}]`);
      }
    };
    syncMetricsRef.current = syncTerminalMetrics;

    const scheduleSyncTerminalMetrics = () => {
      if (metricsDebounce) clearTimeout(metricsDebounce);
      metricsDebounce = setTimeout(() => {
        metricsDebounce = null;
        syncTerminalMetrics();
      }, 60);
    };

    const ro = new ResizeObserver(() => scheduleHostSync());
    ro.observe(host);

    window.addEventListener("resize", scheduleSyncTerminalMetrics);
    window.visualViewport?.addEventListener(
      "resize",
      scheduleSyncTerminalMetrics,
    );
    scheduleHostSync();
    requestAnimationFrame(() => scheduleHostSync());

    // Double-rAF authoritative fit.  On the second frame the layout has
    // committed at least once since mount; fit.fit() then reads the
    // stable container size.  We always send a RESIZE escape afterwards
    // (even if fit's cols/rows didn't change, so the PTY has the same
    // dims registered as our JS state — prevents a drift where Ink
    // thinks the terminal is one col bigger than what's on screen).
    let settleRaf1 = 0;
    let settleRaf2 = 0;
    settleRaf1 = requestAnimationFrame(() => {
      settleRaf1 = 0;
      settleRaf2 = requestAnimationFrame(() => {
        settleRaf2 = 0;
        syncTerminalMetrics();
      });
    });

    // WebSocket. In gated mode (``window.__IDRAK_IT_AUTH_REQUIRED__``) this
    // awaits a single-use ticket via /api/auth/ws-ticket before opening;
    // in loopback mode it resolves synchronously against the injected
    // session token. The IIFE keeps the outer effect synchronous so its
    // ``return cleanup`` stays at the top level; handlers + disposables
    // are hoisted to ``let`` bindings the cleanup closes over.
    let unmounting = false;
    let onDataDisposable: { dispose(): void } | null = null;
    let onResizeDisposable: { dispose(): void } | null = null;
    let guidedWriteDisposable: { dispose(): void } | null = null;
    let builderSeedTimer: number | null = null;
    guidedAgentReadyRef.current = false;
    setGuidedAgentReady(false);
    setGuidedReadyTimedOut(false);
    const forceFresh = forceFreshPtyRef.current;
    forceFreshPtyRef.current = false;
    // A connect attempt is now in flight — set synchronously (before the async
    // socket-open IIFE below awaits its ticket URL) so a page-resume event in
    // that gap doesn't fire a redundant reconnect (wsRef isn't assigned yet).
    connectInFlightRef.current = true;
    const clearConnectingTimer = () => {
      if (connectingTimerRef.current) {
        clearTimeout(connectingTimerRef.current);
        connectingTimerRef.current = null;
      }
    };
    const scheduleReconnect = (code: number) => {
      if (reconnectTimerRef.current) {
        return;
      }
      const attempt = Math.min(reconnectAttemptRef.current + 1, 5);
      reconnectAttemptRef.current = attempt;
      const delayMs = Math.min(250 * 2 ** (attempt - 1), 3000);
      setBanner(null);
      setLastCloseCode(code);
      setPtyState("reconnecting");
      reconnectTimerRef.current = setTimeout(() => {
        reconnectTimerRef.current = null;
        setReconnectNonce((n) => n + 1);
      }, delayMs);
    };
    void (async () => {
      if (unmounting) return;
      const params: Record<string, string> = { channel };
      if (resumeParam) params.resume = resumeParam;
      if (forceFresh) params.fresh = "1";
      // Keep-alive identity: reattach to this tab's living PTY across
      // refresh/transient drops. A forced-fresh start rotates the token so
      // the previous keep-alive PTY is not reattached (registry reaps it).
      params.attach = ptyAttachToken(forceFresh);
      // Profile-scoped chat: the PTY child gets HERMES_HOME pointed at the
      // selected profile, so the conversation runs with that profile's model,
      // skills, memory, and sessions (see web_server._resolve_chat_argv).
      if (scopedProfile) params.profile = scopedProfile;
      if (workspaceParam) params.workspace = workspaceParam;
      if (guided) {
        params.skills = guidedSessionSkillsRef.current.join(",");
      }
      const url = await api.buildWsUrl("/api/pty", params);
      const ws = new WebSocket(url);
      ws.binaryType = "arraybuffer";
      wsRef.current = ws;
      // W2 (NS-591): a mobile socket can wedge in CONNECTING after a radio
      // handoff and never fire onclose, so neither the resume predicate nor
      // scheduleReconnect can recover it. Force-close if it hasn't opened
      // within the budget; the resulting onclose routes into scheduleReconnect.
      clearConnectingTimer();
      connectingTimerRef.current = setTimeout(() => {
        connectingTimerRef.current = null;
        if (wsRef.current === ws && ws.readyState === WebSocket.CONNECTING) {
          try {
            ws.close();
          } catch {
            /* already tearing down */
          }
        }
      }, PTY_CONNECTING_TIMEOUT_MS);

    ws.onopen = () => {
      clearReconnectTimer();
      clearConnectingTimer();
      connectInFlightRef.current = false;
      reconnectAttemptRef.current = 0;
      setBanner(null);
      setLastCloseCode(null);
      setPtyState("open");
      blockedInputNoticeRef.current = false;
      // Connected — cancel any pending reconnect from a prior transient drop.
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      // Send the initial RESIZE immediately so Ink has *a* size to lay
      // out against on its first paint.  The double-rAF block above will
      // follow up with the authoritative measurement — at worst Ink
      // reflows once after the PTY boots, which is imperceptible.
      ws.send(`\x1b[RESIZE:${term.cols};${term.rows}]`);
      // One-shot: a ?learn=<text> param (set by the Skills page "Learn a
      // skill" panel) is typed into the composer as a /learn command once the
      // PTY is up. /learn resolves via command.dispatch → a normal agent turn,
      // so this reuses the existing composer path — no special PTY protocol.
      const learnSeed = searchParams.get("learn");
      if (learnSeed) {
        const next = new URLSearchParams(searchParams);
        next.delete("learn");
        setSearchParams(next, { replace: true });
        const cmd = `/learn ${learnSeed}`.trim();
        // Delay so Ink's composer has mounted and grabbed focus before input.
        setTimeout(() => {
          try {
            wsRef.current?.send(cmd + "\r");
          } catch {
            /* PTY not ready / closed — user can retype */
          }
        }, 800);
      }
      const builderSeed = searchParams.get("builder");
      if (builderSeed) {
        const readyDeadline = Date.now() + 15_000;
        const sendWhenReady = () => {
          const active = wsRef.current;
          if (!active || active.readyState !== WebSocket.OPEN) return;
          if (
            !guidedAgentReadyRef.current &&
            !terminalComposerIsReady(term)
          ) {
            if (Date.now() < readyDeadline) {
              builderSeedTimer = window.setTimeout(sendWhenReady, 250);
            } else {
              setGuidedReadyTimedOut(true);
              appendGuidedError(
                "The project conversation did not finish preparing. Use Restart project chat below to reconnect it without losing this project’s saved conversation.",
              );
              guidedTurnSettledRef.current = true;
              setGuidedActivity({
                phase: "idle",
                text: "",
                specialist: null,
              });
            }
            return;
          }
          markGuidedAgentReady();
          guidedWelcomeStartedRef.current = true;
          const next = new URLSearchParams(searchParams);
          next.delete("builder");
          setSearchParams(next, { replace: true });
          guidedTurnStartLineRef.current = Math.max(
            0,
            term.buffer.active.length - 1,
          );
          guidedTurnSettledRef.current = false;
          setGuidedActivity({
            phase: "working",
            text: "Let me think…",
            specialist: guidedDefaultSpecialistRef.current,
          });
          setGuidedLastSignalAt(Date.now());
          writeGuidedPrompt(builderSeed, {
            isOpen: () => wsRef.current?.readyState === WebSocket.OPEN,
            schedule: (run, delayMs) => window.setTimeout(run, delayMs),
            send: (data) => active.send(data),
          });
        };
        builderSeedTimer = window.setTimeout(sendWhenReady, 100);
      } else {
        const readyDeadline = Date.now() + 15_000;
        const markReady = () => {
            if (wsRef.current?.readyState !== WebSocket.OPEN || unmounting) {
            return;
          }
          if (
            guidedAgentReadyRef.current ||
            terminalComposerIsReady(term)
          ) {
            markGuidedAgentReady();
            if (
              guided &&
              guidedMessagesRef.current.length === 0 &&
              !guidedWelcomeStartedRef.current
            ) {
              guidedWelcomeStartedRef.current = true;
              guidedTurnStartLineRef.current = Math.max(
                0,
                term.buffer.active.length - 1,
              );
              guidedTurnSettledRef.current = false;
              setGuidedActivity({
                phase: "working",
                text: "Lyra is getting to know your project…",
                specialist: APP_IT_SPECIALIST,
              });
              // Resolve the listing first so the agent can greet in ONE model
              // round-trip instead of inspecting and then greeting. Capped so a
              // slow or unresponsive filesystem degrades to a plain greeting
              // rather than stalling the session.
              void Promise.race([
                fetchProjectSummary(workspaceParam),
                new Promise<string>((resolve) =>
                  window.setTimeout(() => resolve(""), 1500),
                ),
              ]).then((projectSummary) => {
                if (wsRef.current?.readyState !== WebSocket.OPEN) return;
                const welcome = guidedWelcomeSeed(
                  workspaceParam,
                  guidedSelectedSpecialistIdsRef.current,
                  guidedSkillModelsRef.current,
                  projectSummary,
                );
                writeGuidedPrompt(welcome, {
                    isOpen: () => wsRef.current?.readyState === WebSocket.OPEN,
                    schedule: (run, delayMs) => window.setTimeout(run, delayMs),
                  send: (data) => wsRef.current?.send(data),
                });
              });
            }
            return;
          }
          if (Date.now() < readyDeadline) {
            builderSeedTimer = window.setTimeout(markReady, 250);
          } else {
            setGuidedReadyTimedOut(true);
            appendGuidedError(
              "The saved project conversation could not reconnect. Use Restart project chat below to resume it.",
            );
          }
        };
        builderSeedTimer = window.setTimeout(markReady, 100);
      }
    };

    ws.onmessage = (ev) => {
      if (typeof ev.data === "string") {
        term.write(ev.data);
      } else {
        term.write(new Uint8Array(ev.data as ArrayBuffer));
      }
    };

    ws.onclose = (ev) => {
      wsRef.current = null;
      connectInFlightRef.current = false;
      clearConnectingTimer();
      if (unmounting) {
        return;
      }
      if (guided) {
        // Never leave a friendly specialist animation claiming work is still
        // happening after its transport has closed. A reconnect or reload
        // will establish a fresh, truthful activity state.
        setGuidedActivity({
          phase: "idle",
          text: "",
          specialist: null,
        });
        guidedTurnSettledRef.current = true;
      }
      // Surface the real cause to the browser console on every close so a
      // "chat won't connect" report can be diagnosed without server access.
      // The server sends a machine-parseable reason on every rejection (see
      // pty_ws in web_server.py); echo it verbatim alongside the close code.
      const why = ev.reason ? ` reason=${ev.reason}` : "";
      console.warn(`[chat] PTY WebSocket closed code=${ev.code}${why}`);
      setLastCloseCode(ev.code);
      if (ev.code === 4401) {
        setPtyState("closed");
        setBanner(
          ev.reason
            ? `Auth failed (${ev.reason}). Reload to refresh the session.`
            : "Auth failed. Reload the page to refresh the session token.",
        );
        return;
      }
      if (ev.code === 4403) {
        // Host/Origin mismatch (DNS-rebinding guard).
        setPtyState("closed");
        setBanner(
          ev.reason
            ? `Refused: ${ev.reason}.`
            : "Refused: request host/origin doesn't match the dashboard.",
        );
        return;
      }
      if (ev.code === 4404) {
        setPtyState("closed");
        setBanner(
          ev.reason
            ? `Chat websocket unavailable: ${ev.reason}.`
            : "Chat websocket unavailable on this server.",
        );
        return;
      }
      if (ev.code === 4408) {
        setPtyState("closed");
        setBanner(
          ev.reason
            ? `Refused: ${ev.reason}.`
            : "Refused: your client isn't permitted (server bound to localhost only).",
        );
        return;
      }
      if (ev.code === 1011) {
        // Server already wrote an ANSI error frame.
        setPtyState("closed");
        return;
      }
      // Keep-alive close-code contract (web_server.pty_ws + pty_session):
      //   4410 = the agent PROCESS exited (real end) → restart affordance.
      //   4409 = superseded by a newer tab attaching the same token → stay quiet.
      if (ev.code === 4410) {
        if (telegramHandoffRequestedRef.current) {
          telegramHandoffRequestedRef.current = false;
          setTelegramHandoffStatus("sent");
          setBanner(null);
          setPtyState("ended");
          return;
        }
        term.write(`\r\n\x1b[90m[session ended]\x1b[0m\r\n`);
        setPtyState("ended");
        return;
      }
      if (ev.code === 4409) {
        setPtyState("closed");
        return;
      }
      if (!ev.wasClean || ev.code === 1001 || ev.code === 1006) {
        // Transient transport drop (refresh, sleep/wake, signal loss).
        // Reconnect with backoff; the same ?attach= token reattaches to
        // the still-living PTY, so the conversation continues in place.
        scheduleReconnect(ev.code);
        return;
      }
      // Normal/clean exit: the agent process ended (e.g. the user typed
      // `/exit`, or started a new session). NS-504: surface an explicit
      // restart affordance instead of leaving a dead terminal that only a
      // full page refresh could recover.
        term.write(`\r\n\x1b[90m[session ended (code ${ev.code})]\x1b[0m\r\n`);
      setPtyState("ended");
    };

    // Keystrokes → PTY.
    //
    // IMPORTANT:
    // The embedded web chat has occasionally surfaced stray letters/digits
    // in the input line after a turn completes. The most likely culprit is
    // browser-side terminal control traffic being forwarded back into the
    // PTY as if it were user text. SGR mouse tracking is the highest-risk
    // path here: xterm.js emits raw CSI reports (`\x1b[<...`) that look like
    // ordinary bytes to the backend.
    //
    // For the browser embed we prefer input stability over terminal-style
    // mouse reporting, so we drop SGR mouse reports entirely instead of
    // forwarding them into Hermes. Keyboard input, paste, and resize still
    // behave normally.
      // eslint-disable-next-line no-control-regex -- intentional ESC byte in xterm SGR mouse report parser
      const SGR_MOUSE_RE = /^\x1b\[<(\d+);(\d+);(\d+)([Mm])$/;
      onDataDisposable = term.onData((data) => {
        // Mouse reports (scroll wheel etc.) are not typed input — swallow
        // them before the blocked-input check so scrolling a disconnected
        // terminal doesn't trip the "reconnecting" notice.
        if (SGR_MOUSE_RE.test(data)) {
          return;
        }

        if (
          ws.readyState !== WebSocket.OPEN ||
          shouldBlockPtyInput(ptyStateRef.current)
        ) {
          if (!blockedInputNoticeRef.current) {
            blockedInputNoticeRef.current = true;
            term.write(
              `\r\n\x1b[33m[${PTY_RECONNECT_INPUT_MESSAGE}]\x1b[0m\r\n`,
            );
          }
          return;
        }

        const normalized = normalizePtyMobileInput(
          data,
          ptyInputLineRef.current,
          Date.now() <= mobileReplacementInputUntilRef.current,
        );
        ptyInputLineRef.current = normalized.nextLine;
        if (normalized.normalized) {
          mobileReplacementInputUntilRef.current = 0;
        }
        ws.send(normalized.data);
      });

      onResizeDisposable = term.onResize(({ cols, rows }) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(`\x1b[RESIZE:${cols};${rows}]`);
        }
      });
      if (guided) {
        guidedWriteDisposable = term.onWriteParsed(() => {
          const snapshot = guidedTerminalSnapshot(
            term,
            guidedTurnStartLineRef.current,
          );
          setGuidedOutput(snapshot.output);
          if (snapshot.errorMessage) {
            setGuidedLastSignalAt(Date.now());
            guidedTurnSettledRef.current = true;
            appendGuidedError(snapshot.errorMessage);
            setGuidedActivity({
              phase: "idle",
              text: "",
              specialist: null,
            });
          } else if (!guidedTurnSettledRef.current) {
            const detected = snapshot.presentation.specialist;
            const selected =
              detected &&
              guidedSelectedSpecialistIdsRef.current.includes(detected.id)
                ? detected
                : null;
            setGuidedActivity((current) => ({
              phase:
                guidedStructuredFeedConnectedRef.current &&
                snapshot.presentation.phase === "response"
                  ? "working"
                  : snapshot.presentation.phase,
              // The PTY may briefly contain a provider's narrated handoff,
              // tool chrome, or model statistics before the structured
              // message.complete event arrives. Structured events are the
              // authoritative guided feed, so never copy that raw terminal
              // text into the friendly live-status card.
              text: guidedStructuredFeedConnectedRef.current
                ? current.text || "Continuing with the next step…"
                : snapshot.presentation.text,
              specialist:
                selected ??
                current.specialist ??
                guidedDefaultSpecialistRef.current,
            }));
          }
          if (
            !guidedStructuredFeedConnectedRef.current &&
            snapshot.presentation.phase === "response" &&
            snapshot.presentation.text &&
            snapshot.presentation.text !== lastGuidedResponseRef.current
          ) {
            setGuidedLastSignalAt(Date.now());
            finishGuidedResponse(snapshot.presentation.text);
          }
        });
      }
    })().catch((error: unknown) => {
      connectInFlightRef.current = false;
      clearConnectingTimer();
      if (unmounting) return;
      console.warn("[chat] PTY WebSocket setup failed", error);
      setPtyState("closed");
      setBanner(
        error instanceof Error
          ? `Chat connection failed: ${error.message}`
          : "Chat connection failed. Reload and try again.",
      );
      if (guided) {
        appendGuidedError(
          error instanceof Error
            ? `The project chat could not connect: ${error.message}`
            : "The project chat could not connect. Reload and try again.",
        );
        setGuidedActivity({
          phase: "idle",
          text: "",
          specialist: null,
        });
      }
    });

    term.focus();

    return () => {
      unmounting = true;
      imageUploadDisposed = true;
      syncMetricsRef.current = null;
      onDataDisposable?.dispose();
      onResizeDisposable?.dispose();
      guidedWriteDisposable?.dispose();
      mobileInputCleanup?.();
      host.removeEventListener("paste", handleBrowserPaste, true);
      host.removeEventListener("dragover", handleBrowserDragOver, true);
      host.removeEventListener("drop", handleBrowserDrop, true);
      if (metricsDebounce) clearTimeout(metricsDebounce);
      window.removeEventListener("resize", scheduleSyncTerminalMetrics);
      window.visualViewport?.removeEventListener(
        "resize",
        scheduleSyncTerminalMetrics,
      );
      ro.disconnect();
      if (hostSyncRaf) cancelAnimationFrame(hostSyncRaf);
      if (settleRaf1) cancelAnimationFrame(settleRaf1);
      if (settleRaf2) cancelAnimationFrame(settleRaf2);
      clearReconnectTimer();
      clearConnectingTimer();
      connectInFlightRef.current = false;
      // Phase 5.3: ``ws`` is local to the IIFE that opens it (the gated-mode
      // ticket fetch makes the open async). The cleanup runs at the outer
      // effect's top level so it can't reach into that scope — close via
      // the ref instead. ``?.`` covers the race where unmount fires before
      // the ticket fetch resolves and ``wsRef.current`` was never assigned.
      wsRef.current?.close();
      wsRef.current = null;
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
      if (copyResetRef.current) {
        clearTimeout(copyResetRef.current);
        copyResetRef.current = null;
      }
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (builderSeedTimer !== null) {
        window.clearTimeout(builderSeedTimer);
        builderSeedTimer = null;
      }
    };
  }, [
    hasActivated,
    channel,
    clearReconnectTimer,
    resumeParam,
    scopedProfile,
    reconnectNonce,
    guided,
    guidedSessionLookupComplete,
    workspaceParam,
    appendGuidedError,
    finishGuidedResponse,
    markGuidedAgentReady,
  ]);

  useEffect(() => {
    const output = guidedOutputRef.current;
    if (!output || !guidedAutoScrollRef.current) return;
    output.scrollTop = output.scrollHeight;
  }, [guidedMessages.length]);

  useEffect(() => {
    if (
      !guided ||
      typeof window === "undefined" ||
      guidedMessageWorkspace !== workspaceParam
    ) {
      return;
    }
    try {
      window.localStorage.setItem(
        guidedMessageStorageKey(workspaceParam),
        JSON.stringify(guidedMessages.slice(-200)),
      );
    } catch {
      // Private browsing/storage limits should not break the live conversation.
    }
  }, [guided, guidedMessageWorkspace, guidedMessages, workspaceParam]);

  useEffect(() => {
    if (!guided || guidedMessageWorkspace !== workspaceParam) return;
    try {
      window.localStorage.setItem(
        guidedPhaseStorageKey(workspaceParam),
        JSON.stringify({
          completed: guidedPhasesCompleted,
          current: guidedPhaseCurrent,
        }),
      );
    } catch {
      // Progress remains live when browser storage is unavailable.
    }
  }, [
    guided,
    guidedMessageWorkspace,
    guidedPhaseCurrent,
    guidedPhasesCompleted,
    workspaceParam,
  ]);

  useEffect(() => {
    if (!guided || guidedActivity.phase !== "working" || guidedCompacting) {
      return;
    }
    const toolGraceDeadline = Math.max(
      0,
      ...Array.from(
        guidedActiveToolsRef.current.values(),
        (tool) => tool.deadline,
      ),
    );
    const graceDeadline = Math.max(
      guidedSubagentGraceUntilRef.current,
      toolGraceDeadline,
    );
    const deadline =
      graceDeadline > 0
        ? graceDeadline
        : guidedLastSignalAt + GUIDED_MODEL_SILENCE_TIMEOUT_MS;
    const remainingMs = Math.max(0, deadline - Date.now());
    const timeout = window.setTimeout(() => {
      const decision = decideGuidedWatchdog({
        subagentGraceUntil: guidedSubagentGraceUntilRef.current,
        toolGraceUntil: Math.max(
          0,
          ...Array.from(
            guidedActiveToolsRef.current.values(),
            (tool) => tool.deadline,
          ),
        ),
        now: Date.now(),
      });
      if (decision.action === "extend") {
        // A semantic event extended the deadline while this timer was firing.
        // Re-arm from that event; never manufacture activity from a timer tick.
        setGuidedLastSignalAt(Date.now());
        return;
      }
      guidedSubagentGraceUntilRef.current = 0;
      guidedActiveToolsRef.current = new Map();
      setGuidedRunningTool(null);
      if (decision.reason === "subagent") {
        sendGuidedControlCommand("/agents stop");
        setGuidedWorkers((current) => markGuidedWorkerStopping(current));
      } else {
        try {
          wsRef.current?.send("\x03");
        } catch {
          // The visible error is still useful if the transport already closed.
        }
      }
      appendGuidedError(guidedWatchdogMessage(decision.reason));
      guidedTurnSettledRef.current = true;
      setGuidedActivity({ phase: "idle", text: "", specialist: null });
    }, remainingMs);
    return () => window.clearTimeout(timeout);
  }, [
    appendGuidedError,
    guided,
    guidedActivity.phase,
    guidedCompacting,
    guidedLastSignalAt,
    sendGuidedControlCommand,
  ]);

  // When the user returns to the chat tab (isActive: false → true), the
  // terminal host just transitioned from display:none to display:flex.
  // ResizeObserver won't fire on that kind of style-driven box change —
  // xterm thinks its grid is still whatever it was when the tab was
  // hidden (or 0×0, if it was hidden before first fit).  Force a refit
  // after two animation frames so layout has committed.
  //
  // Focus handling: we only steal focus back into the terminal when
  // nothing else inside ChatPage was holding it (typically the first
  // activation after mount, where document.activeElement is <body>; or
  // a return after the user had been typing in the terminal, where
  // focus was already on the xterm textarea before the tab got hidden
  // and has since fallen back to <body>).  If the user had clicked
  // into the sidebar (model picker, tool-call entry) before switching
  // tabs, we must not yank focus away from wherever they left it when
  // they come back — that's a surprise and an a11y foot-gun.
  useEffect(() => {
    if (!isActive) return;
    let raf1 = 0;
    let raf2 = 0;
    raf1 = requestAnimationFrame(() => {
      raf1 = 0;
      raf2 = requestAnimationFrame(() => {
        raf2 = 0;
        syncMetricsRef.current?.();
        const host = hostRef.current;
        const active =
          typeof document !== "undefined" ? document.activeElement : null;
        const focusIsElsewhereInChatPage =
          active !== null &&
          active !== document.body &&
          host !== null &&
          !host.contains(active);
        if (!focusIsElsewhereInChatPage) {
          termRef.current?.focus();
        }
      });
    });
    return () => {
      if (raf1) cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
    };
  }, [isActive]);

  const maybeReconnectOnPageResume = useCallback(() => {
    const visibilityState =
      typeof document !== "undefined" ? document.visibilityState : "visible";
    const online =
      typeof navigator === "undefined" ? true : navigator.onLine !== false;
    const socketReadyState = wsRef.current?.readyState ?? null;

    if (banner && ptyStateRef.current === "closed") {
      return;
    }

    if (
      shouldReconnectPtyOnPageResume({
        isActive,
        visibilityState,
        online,
        socketReadyState,
        ptyState: ptyStateRef.current,
        connectInFlight: connectInFlightRef.current,
      })
    ) {
      const now = Date.now();
      if (
        now - lastResumeReconnectAtRef.current <
        PTY_RESUME_RECONNECT_THROTTLE_MS
      ) {
        return;
      }
      lastResumeReconnectAtRef.current = now;
      reconnectPty();
    }
  }, [banner, isActive, reconnectPty]);

  useEffect(() => {
    if (!isActive || typeof window === "undefined") {
      return;
    }

    const onResume = () => maybeReconnectOnPageResume();

    document.addEventListener("visibilitychange", onResume);
    window.addEventListener("pageshow", onResume);
    window.addEventListener("focus", onResume);
    window.addEventListener("online", onResume);

    return () => {
      document.removeEventListener("visibilitychange", onResume);
      window.removeEventListener("pageshow", onResume);
      window.removeEventListener("focus", onResume);
      window.removeEventListener("online", onResume);
    };
  }, [isActive, maybeReconnectOnPageResume]);

  // Keep the live xterm theme in sync when the active theme's terminal
  // colors change (e.g. user switches to a custom YAML theme mid-session).
  useEffect(() => {
    const term = termRef.current;
    if (!term) return;
    term.options.theme = terminalTheme;
  }, [terminalTheme]);

  // Layout:
  //   outer flex column — sits inside the dashboard's content area
  //   row split — terminal pane (flex-1) + sidebar (fixed width, lg+)
  //   terminal wrapper — rounded, dark, padded — the "terminal window"
  //   floating copy button — bottom-right corner, transparent with a
  //     subtle border; stays out of the way until hovered.  Sends
  //     `/copy\n` to Ink, which emits OSC 52 → our clipboard handler.
  //   sidebar — ChatSidebar opens its own JSON-RPC sidecar; renders
  //     model badge, tool-call list, model picker. Best-effort: if the
  //     sidecar fails to connect the terminal pane keeps working.
  //
  // Mobile model/tools sheet is portaled to `document.body` so it stacks
  // above the app sidebar (`z-50`) and mobile chrome (`z-40`).  The main
  // dashboard column uses `relative z-2`, which traps `position:fixed`
  // descendants below those layers (see Toast.tsx).
  const reconnectBanner =
    ptyState === "reconnecting"
      ? `Chat connection interrupted${lastCloseCode ? ` (code ${lastCloseCode})` : ""}. Reconnecting...`
      : null;
  const visibleBanner = banner ?? reconnectBanner;
  const showReconnectOverlay =
    ptyState === "reconnecting" || (ptyState === "closed" && !banner);
  const mobileModelToolsPortal =
    isActive &&
    narrow &&
    portalRoot &&
    createPortal(
      <>
        {mobilePanelOpen && (
          <Button
            ghost
            aria-label={t.app.closeModelTools}
            onClick={closeMobilePanel}
            className={cn("fixed inset-0 z-[55] p-0 block", "bg-black/60")}
          />
        )}

        <div
          id="chat-side-panel"
          role="complementary"
          aria-label={modelToolsLabel}
          className={cn(
            "font-mondwest fixed top-0 right-0 z-[60] flex h-dvh max-h-dvh w-64 min-w-0 flex-col antialiased",
            "border-l border-current/20 text-midground",
            "bg-background-base/95",
            "transition-transform duration-200 ease-out",
            "[background:var(--component-sidebar-background)]",
            "[clip-path:var(--component-sidebar-clip-path)]",
            "[border-image:var(--component-sidebar-border-image)]",
            mobilePanelOpen
              ? "translate-x-0"
              : "pointer-events-none translate-x-full",
          )}
        >
          <div
            className={cn(
              "flex h-14 shrink-0 items-center justify-between gap-2 border-b border-current/20 px-5",
            )}
          >
            <Typography
              mondwest
              className="text-display font-bold text-[1.125rem] leading-[0.95] tracking-[0.0525rem] text-midground"
            >
              {t.app.modelToolsSheetTitle}
              <br />
              {t.app.modelToolsSheetSubtitle}
            </Typography>

            <Button
              ghost
              size="icon"
              onClick={closeMobilePanel}
              aria-label={t.app.closeModelTools}
              className="text-text-secondary hover:text-midground"
            >
              <X />
            </Button>
          </div>

          <div
            className={cn(
              "min-h-0 flex-1 overflow-y-auto overflow-x-hidden",
              "border-t border-current/10",
            )}
          >
            <div className="border-b border-current/10 px-1 py-2">
              <ChatSidebar
                channel={channel}
                profile={scopedProfile}
                onDashboardNewSessionRequest={startFreshDashboardChat}
                onSessionTitleChange={handleSessionTitleChange}
              />
            </div>
            <ChatSessionList
              activeSessionId={resumeParam}
              profile={scopedProfile}
              onPicked={closeMobilePanel}
              onNewChat={startFreshDashboardChat}
            />
          </div>
        </div>
      </>,
      portalRoot,
    );

  const guidedSkillsPortal =
    guided &&
    guidedSkillsOpen &&
    portalRoot &&
    createPortal(
      <div className="font-mondwest fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-6">
        <button
          type="button"
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          aria-label="Close project agents"
          onClick={() => setGuidedSkillsOpen(false)}
        />
        {/* Fixed height, not max-h: with a content-driven height the panel
            grew and shrank as specialists were ticked, and because the overlay
            centres it, every change moved the header and the whole list under
            the pointer. A constant height keeps header, toolbar and footer
            pinned; only the inner list scrolls. */}
        <section
          ref={guidedSkillsDialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="guided-skills-title"
          className={GUIDED_SPECIALISTS_PANEL}
        >
          <header className="flex shrink-0 items-start justify-between gap-4 border-b border-current/15 px-5 py-4 sm:px-6">
            <div>
              <h2
                id="guided-skills-title"
                className="text-xl font-semibold text-midground"
              >
                {guidedModelReview
                  ? "Review agent models"
                  : guidedTeamRecommendationPending
                    ? "Lyra’s recommended team"
                    : "Project agents"}
              </h2>
              <p className="mt-1 text-sm text-text-secondary">
                {guidedModelReview
                  ? `You switched to ${guidedModelReview.provider}. Choose replacements for models that provider does not offer; Lyra will not guess an equivalent.`
                  : guidedTeamRecommendationPending
                    ? "Review Lyra’s smallest-team recommendation. Select or unselect agents before confirming."
                    : "Lyra is always available. Requirements stays on the team and activates only when discovery or a material change needs it. Choose only the extra agents this project needs."}
              </p>
            </div>
            <Button
              ghost
              size="icon"
              aria-label="Close project agents"
              onClick={() => setGuidedSkillsOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </header>

          <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-current/10 px-5 py-3 sm:px-6">
            <span className="text-xs text-text-secondary">
              {guidedSkillDraftIds.length} of{" "}
              {GUIDED_SELECTABLE_SPECIALIST_IDS.length} selected
            </span>
            <div className="flex gap-3 text-xs">
              {guidedRecommendedSpecialistIds.length > 0 && (
              <button
                type="button"
                className="text-midground hover:underline"
                onClick={() =>
                    setGuidedSkillDraftIds([...guidedRecommendedSpecialistIds])
                }
              >
                  Reset to recommendation
              </button>
              )}
              <button
                type="button"
                className="text-midground hover:underline"
                onClick={() =>
                  setGuidedSkillDraftIds(
                    withRequiredGuidedSpecialists(
                      [],
                      GUIDED_SELECTABLE_SPECIALIST_IDS,
                    ),
                  )
                }
              >
                Clear optional
              </button>
            </div>
          </div>

          {/* overscroll-contain stops a flick at the list's end from chaining
              into the page behind, which on mobile re-triggers the browser
              chrome show/hide that changes dvh. */}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6">
            <div className="grid gap-3 md:grid-cols-2">
              {GUIDED_SELECTABLE_SPECIALIST_IDS.map((id) => {
                const required = isRequiredGuidedSpecialist(id);
                const selected = required || guidedSkillDraftIds.includes(id);
                const assignedModel = guidedSkillModelDraft[id] ?? "";
                const modelChoices =
                  assignedModel && !guidedModelOptions.includes(assignedModel)
                    ? [assignedModel, ...guidedModelOptions]
                    : guidedModelOptions;
                const modelUnavailable = Boolean(
                  selected &&
                    assignedModel &&
                    guidedModelOptions.length &&
                    !guidedModelOptions.includes(assignedModel),
                );
                return (
                  <div
                    key={id}
                    className={cn(
                      "rounded-xl border p-3 transition-colors",
                      modelUnavailable
                        ? "border-warning/70 bg-warning/[0.08]"
                        : selected
                        ? "border-midground/45 bg-midground/[0.07]"
                        : "border-current/15 bg-midground/[0.02] hover:border-current/30",
                    )}
                  >
                    <label
                      className={cn(
                        "grid grid-cols-[24px_64px_minmax(0,1fr)] items-center gap-3",
                        required ? "cursor-default" : "cursor-pointer",
                      )}
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={selected}
                        disabled={required}
                        onChange={() => toggleGuidedSpecialistDraft(id)}
                      />
                      <span
                        className={cn(
                          "grid h-6 w-6 place-items-center rounded-md border text-xs",
                          selected
                            ? "border-midground bg-midground text-background-base"
                            : "border-current/25 text-transparent",
                        )}
                      >
                        ✓
                      </span>
                      <GuidedAgentAvatar
                        id={id}
                        muted={!selected}
                        className={cn(
                          "h-16 w-16 rounded-xl border border-current/15 object-cover shadow-md transition-all",
                          selected ? "opacity-100" : "scale-95 opacity-60",
                        )}
                      />
                      <span className="min-w-0">
                        <strong className="block text-sm text-midground">
                          {guidedAgentName(id)}
                          {required && (
                            <span className="ml-2 rounded-full border border-current/25 px-2 py-0.5 text-[10px] font-normal uppercase tracking-widest text-text-secondary">
                              Always available
                            </span>
                          )}
                          {!required &&
                            guidedRecommendedSpecialistIds.includes(id) && (
                              <span className="ml-2 rounded-full border border-midground/35 bg-midground/10 px-2 py-0.5 text-[10px] font-normal uppercase tracking-widest text-midground">
                                Recommended
                              </span>
                            )}
                        </strong>
                        <small className="mt-1 block text-xs leading-5 text-text-secondary">
                          {GUIDED_SPECIALIST_DESCRIPTIONS[id]}
                        </small>
                      </span>
                    </label>
                    {/* Always rendered, disabled when the specialist is off.
                        This row used to mount only while selected, so ticking
                        a box changed the card's height — and with it the grid
                        row's height, the list's scrollHeight and the panel's
                        own height. Everything below the click jumped. Keeping
                        the row reserves the space and holds the layout still. */}
                    <div className={guidedSpecialistModelRowClass(selected)}>
                      <span className="text-[10px] font-semibold uppercase tracking-widest text-midground">
                        LLM
                      </span>
                      <select
                        value={assignedModel}
                        disabled={!selected}
                        aria-label={`LLM for the ${guidedAgentName(id)}`}
                        className="h-9 min-w-0 rounded-lg border border-current/20 bg-background-base px-2 text-xs text-text-primary outline-none focus:border-midground/60 disabled:cursor-not-allowed"
                        onChange={(event) =>
                          updateGuidedSpecialistModelDraft(
                            id,
                            event.target.value,
                          )
                        }
                      >
                        <option value="">
                          Follow project model · {guidedDefaultModelLabel}
                        </option>
                        {modelChoices.map((model) => (
                          <option key={model} value={model}>
                            {model === assignedModel && modelUnavailable
                              ? `Unavailable on ${guidedModelReview?.provider || "current provider"} · ${model}`
                              : model}
                          </option>
                        ))}
                      </select>
                      {modelUnavailable && (
                        <span className="col-span-2 text-[10px] font-semibold text-warning">
                          Choose a replacement or Follow project model
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-current/15 px-5 py-4 sm:px-6">
            <span className="text-xs text-text-secondary">
              {guidedUnavailableDraftModels.length
                ? `${guidedUnavailableDraftModels.length} model ${guidedUnavailableDraftModels.length === 1 ? "choice needs" : "choices need"} your decision before chat continues.`
                : guidedModelReview
                  ? "Your choices will replace the old provider’s model assignments."
                  : guidedTeamRecommendationPending
                    ? "Nothing starts until you confirm this selection."
                    : "Exact model overrides are provider-specific."}
            </span>
            <div className="flex gap-2">
              <Button outlined onClick={() => setGuidedSkillsOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={saveGuidedSkills}
                disabled={
                  !guidedAgentReady ||
                  ptyState !== "open" ||
                  guidedUnavailableDraftModels.length > 0
                }
              >
                {guidedModelReview
                  ? "Confirm replacement models"
                  : guidedTeamRecommendationPending
                    ? "Confirm selected agents"
                    : "Save changes"}
              </Button>
            </div>
          </footer>
        </section>
      </div>,
      portalRoot,
    );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <PluginSlot name="chat:top" />
      {mobileModelToolsPortal}
      {guidedSkillsPortal}

      {visibleBanner && (
        <div className="border border-warning/50 bg-warning/10 text-warning px-3 py-2 text-xs tracking-wide">
          {visibleBanner}
        </div>
      )}

      {guided && (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-current/15 bg-background-base shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-current/10 px-4 py-3 sm:px-5">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-semibold text-midground">
                <FolderOpen className="h-4 w-4" />
                <span className="truncate">{projectName}</span>
              </div>
              <div className="mt-1 truncate text-xs text-text-secondary">
                {workspaceParam || "Guided project chat"}
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-1 sm:gap-2">
              <details className="group relative lg:hidden">
                <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-md border border-current/15 px-2 py-1.5 text-xs text-text-secondary">
                  <Activity className="h-3.5 w-3.5" />
                  {guidedActiveWorkers.length
                    ? `${guidedActiveWorkers.length} working`
                    : "Activity"}
                </summary>
                <div className="fixed right-4 top-24 z-30 flex max-h-[70vh] w-[min(18rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-current/20 bg-background-base shadow-2xl">
                  <GuidedRuntimePanel
                    activeWorkers={guidedActiveWorkers}
                    activity={guidedActivity}
                    currentSpecialist={guidedWorkingSpecialist}
                    defaultModelLabel={guidedDefaultModelLabel}
                    lastSignalAt={guidedLastSignalAt}
                    onRetry={retryLastGuidedMessage}
                    paused={guidedPaused}
                    recentWorkers={guidedRecentWorkers}
                    runningTool={guidedRunningTool}
                    usage={guidedUsage}
                    onStopWorker={(id) => stopGuidedWorkers(id)}
                  />
                </div>
              </details>
              <details
                className={cn(
                  "group relative",
                  guidedPreviewOpen ? "2xl:hidden" : "xl:hidden",
                )}
              >
                <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-md border border-current/15 px-2 py-1.5 text-xs text-text-secondary">
                  <MapIcon className="h-3.5 w-3.5" />
                  Done {guidedProgressSummary.completed} · Open{" "}
                  {guidedProgressSummary.remaining}
                </summary>
                <div className="fixed right-4 top-24 z-30 flex max-h-[72vh] w-[min(19rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-current/20 bg-background-base shadow-2xl">
                  <GuidedProgressMap
                    durable={guidedLedgerSteps !== null}
                    steps={guidedPhaseSteps}
                  />
                </div>
              </details>
              <Button
                outlined
                size="sm"
                onClick={() => setGuidedPreviewOpen((value) => !value)}
                aria-expanded={guidedPreviewOpen}
                title="Open the local app and select rendered elements"
              >
                <Monitor className="mr-1 h-3.5 w-3.5" />
                {guidedPreviewOpen ? "Close preview" : "App preview"}
              </Button>
              <Button
                outlined
                size="sm"
                onClick={continueGuidedOnTelegram}
                title={telegramRemoteHint(telegramReadiness)}
                disabled={
                  telegramRemoteLoading ||
                  guidedActivity.phase === "working" ||
                  telegramHandoffStatus === "sending" ||
                  telegramHandoffStatus === "sent"
                }
              >
                <MessageCircle className="mr-1 h-3.5 w-3.5" />
                {telegramRemoteLoading
                  ? "Checking phone…"
                  : telegramHandoffStatus === "sending"
                  ? "Moving to Telegram…"
                  : telegramHandoffStatus === "sent"
                  ? "On Telegram"
                  : telegramRemoteButtonLabel(telegramReadiness)}
              </Button>
              <Button
                ghost
                size="sm"
                onClick={openGuidedSkills}
                aria-expanded={guidedSkillsOpen}
                disabled={!guidedAgentReady}
              >
                Agents ({guidedSelectedSpecialistIds.length})
              </Button>
              <Button ghost size="sm" onClick={toggleGuidedPause}>
                {guidedPaused ? (
                  <Play className="mr-1 h-3.5 w-3.5" />
                ) : (
                  <Pause className="mr-1 h-3.5 w-3.5" />
                )}
                {guidedPaused ? "Resume workers" : "Pause workers"}
              </Button>
              {guidedActiveWorkers.length > 0 && (
                <Button
                  ghost
                  size="sm"
                  onClick={() => stopGuidedWorkers()}
                  title="Stop every active project agent"
                >
                  <CircleStop className="mr-1 h-3.5 w-3.5" />
                  Stop workers
                </Button>
              )}
              <Button
                ghost
                size="sm"
                onClick={clearGuidedHistory}
                title="Clear chat history and start fresh"
              >
                <Trash2 className="mr-1 h-3.5 w-3.5" />
                Clear
              </Button>
              <Button
                ghost
                size="sm"
                onClick={() => {
                  const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`;
                  window.location.href = `/models?returnTo=${encodeURIComponent(returnTo)}`;
                }}
              >
                AI model
              </Button>
              <Button
                ghost
                size="sm"
                onClick={() => {
                  window.location.href = "/ultimate-builder";
                }}
              >
                ← Projects
              </Button>
            </div>
          </div>

          <div className="flex min-h-0 min-w-0 flex-1">
            <aside
              aria-label="Live agents and token usage"
              className="hidden w-56 shrink-0 overflow-hidden border-r border-current/10 bg-midground/[0.025] lg:flex xl:w-60"
            >
              <GuidedRuntimePanel
                activeWorkers={guidedActiveWorkers}
                activity={guidedActivity}
                currentSpecialist={guidedWorkingSpecialist}
                defaultModelLabel={guidedDefaultModelLabel}
                lastSignalAt={guidedLastSignalAt}
                onRetry={retryLastGuidedMessage}
                paused={guidedPaused}
                recentWorkers={guidedRecentWorkers}
                runningTool={guidedRunningTool}
                usage={guidedUsage}
                onStopWorker={(id) => stopGuidedWorkers(id)}
              />
            </aside>

            <div className="flex min-h-0 min-w-0 flex-1 flex-col">

          {telegramHandoffStatus !== "idle" && (
            <div
              className={cn(
                "flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 text-sm sm:px-5",
                telegramHandoffStatus === "failed"
                  ? "border-warning/30 bg-warning/10 text-warning"
                  : "border-current/10 bg-midground/5 text-text-secondary",
              )}
            >
              <span>
                {telegramHandoffStatus === "sent"
                  ? "This project is now on Telegram. Lyra will notify your phone when she asks a question or needs approval."
                  : telegramHandoffStatus === "failed"
                  ? "The Telegram handoff did not complete. Check that the gateway is connected and that you pressed Start in the bot."
                  : "Moving this project and its conversation history to Telegram…"}
              </span>
              {telegramHandoffStatus === "failed" && (
                <Button
                  ghost
                  size="sm"
                  onClick={() => {
                    setTelegramHandoffStatus("idle");
                    continueGuidedOnTelegram();
                  }}
                >
                  Retry
                </Button>
              )}
            </div>
          )}

          {guidedApproval && (
            <div className="shrink-0 border-b border-warning/35 bg-warning/[0.07] px-4 py-3 sm:px-7">
              <div role="alert" className="mx-auto max-w-3xl">
                <strong className="block text-sm text-warning">
                  Approval needed
                </strong>
                <p className="mt-1 text-sm text-text-primary">
                  {guidedApproval.description}
                </p>
                {guidedApproval.command && (
                  <pre className="mt-2 max-h-28 overflow-auto whitespace-pre-wrap break-all rounded-lg border border-current/15 bg-background-base/70 p-2.5 text-[11px] leading-5 text-text-secondary">
                    {guidedApproval.command}
                  </pre>
                )}
                <div className="mt-2 flex flex-wrap gap-2">
                  {guidedApproval.choices.map((choice) => (
                    <Button
                      key={choice}
                      size="sm"
                      outlined={choice !== "once"}
                      onClick={() => respondToGuidedApproval(choice)}
                    >
                      {GUIDED_APPROVAL_LABELS[choice]}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div
            ref={guidedOutputRef}
            onScroll={(event) => {
              const element = event.currentTarget;
              guidedAutoScrollRef.current =
                element.scrollHeight -
                  element.scrollTop -
                  element.clientHeight <
                80;
            }}
            className="min-h-0 flex-1 overflow-y-auto px-4 py-3 sm:px-7 sm:py-4"
            aria-live="polite"
          >
            <div className="mx-auto max-w-3xl text-[15px] leading-7 text-text-primary">
              {guidedPaused && (
                <div className="mb-4 rounded-xl border border-warning/30 bg-warning/10 p-5 text-warning">
                  Background agents are paused. Lyra is still available—ask a
                  question, change direction, or select Resume workers.
                </div>
              )}
              {hasModelConnectionError && (
                <div className="mb-4 rounded-xl border border-warning/40 bg-warning/10 p-5">
                  <strong className="block text-midground">
                    Connect an AI model to continue
                  </strong>
                  <span className="mt-2 block text-sm text-text-secondary">
                    The current AWS Bedrock credentials are not valid. Choose a
                    working provider and model in AI model settings.
                  </span>
                  <Button
                    className="mt-4"
                    size="sm"
                    onClick={() => {
                      const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`;
                      window.location.href = `/models?returnTo=${encodeURIComponent(returnTo)}`;
                    }}
                  >
                    Open AI model settings
                  </Button>
                </div>
              )}
              <div className="space-y-4">
                {guidedMessages.map((message) => {
                  const copyText = chatMessageCopyText(message);
                  return (
                  <div
                    key={message.id}
                    className={cn(
                      "flex",
                        message.role === "user"
                          ? "justify-end"
                          : "justify-start",
                    )}
                  >
                    <div
                      className={cn(
                        // `group` so the copy button can reveal itself on
                        // hover over anywhere in the bubble, not just itself.
                        "group max-w-[88%] rounded-2xl px-4 py-3 shadow-sm sm:max-w-[78%]",
                        message.role === "user"
                          ? "whitespace-pre-wrap rounded-br-md bg-midground text-background-base"
                          : message.role === "error"
                          ? "whitespace-pre-wrap rounded-bl-md border border-warning/40 bg-warning/10 text-warning"
                          : "rounded-bl-md border border-current/10 bg-midground/5 text-text-primary",
                      )}
                    >
                      <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider">
                        <span className="opacity-65">
                          {message.role === "user"
                            ? "You"
                            : message.role === "error"
                            ? "Problem"
                            : "Lyra"}
                        </span>
                        {copyText ? (
                          <CopyMessageButton
                            className="-my-1 ml-auto"
                            text={copyText}
                            roleLabel={
                              message.role === "user"
                                ? "your"
                                : message.role === "error"
                                ? "this error"
                                : "Lyra"
                            }
                          />
                        ) : null}
                      </div>
                      {message.role === "assistant" ? (
                        <Markdown content={message.content} />
                      ) : (
                        message.content
                      )}
                      {showRequirementsApproval &&
                        message.id === latestGuidedMessage?.id && (
                          <div className="mt-3 flex flex-wrap gap-2 border-t border-current/10 pt-3">
                            <Button
                              size="sm"
                              onClick={() => submitGuidedText("approve")}
                            >
                              Approve requirements
                            </Button>
                            <span className="self-center text-xs text-text-secondary">
                              Or type what you would like changed.
                            </span>
                          </div>
                        )}
                      {showWorkflowApproval &&
                        message.id === latestGuidedMessage?.id && (
                          <div className="mt-3 flex flex-wrap gap-2 border-t border-current/10 pt-3">
                            <Button
                              size="sm"
                              onClick={() => submitGuidedText("approve")}
                            >
                              Approve and continue
                            </Button>
                            <span className="self-center text-xs text-text-secondary">
                              Or type what you would like changed.
                            </span>
                          </div>
                        )}
                      {showRequirementChoices &&
                        message.id === latestGuidedMessage?.id && (
                          <div className="mt-3 flex flex-wrap gap-2 border-t border-current/10 pt-3">
                            <Button
                              ghost
                              size="sm"
                              onClick={() =>
                                submitGuidedText(
                                  "Skip this question. Record it as an open decision and ask the next single question.",
                                )
                              }
                            >
                              Skip this question
                            </Button>
                            <Button
                              ghost
                              size="sm"
                              onClick={() =>
                                submitGuidedText(
                                  "Decide this question for me using the safest sensible default. Briefly state the default, then ask the next single question.",
                                )
                              }
                            >
                              Decide for me
                            </Button>
                            <Button
                              ghost
                              size="sm"
                              onClick={() =>
                                submitGuidedText(
                                  "Use sensible defaults for all remaining requirements questions. Summarize the complete requirements and choices for my approval before any coding.",
                                )
                              }
                            >
                              Use smart defaults
                            </Button>
                          </div>
                        )}
                      {message.role === "error" && (
                        <Button
                          className="mt-3"
                          ghost
                          size="sm"
                          onClick={retryLastGuidedMessage}
                        >
                          Stop & retry
                        </Button>
                      )}
                    </div>
                  </div>
                  );
                })}

                {!hasModelConnectionError &&
                  guidedActivity.phase === "working" && (
                    <div className="flex justify-start">
                      <div className="max-w-[88%] rounded-2xl rounded-bl-md border border-current/10 bg-midground/5 px-4 py-3 sm:max-w-[78%]">
                        <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-midground">
                          <Bot className="h-3.5 w-3.5" />
                          Lyra
                        </div>
                        <p className="text-sm text-text-secondary">
                          The project agents are working in the background. I’m
                          still here if you need anything or want to change
                          direction.
                        </p>
                      </div>
                    </div>
                  )}

                {!hasModelConnectionError &&
                  guidedMessages.length === 0 &&
                  guidedActivity.phase === "idle" && (
                    <div className="rounded-xl border border-current/10 bg-midground/5 p-5 text-text-secondary">
                      {ptyState === "open"
                        ? "Let’s start building. What’s the cool idea?"
                        : "Lyra is preparing your project conversation…"}
                    </div>
                  )}
              </div>
            </div>
          </div>

          <div
            className="border-t border-current/10 bg-background-base p-2 sm:p-3"
            onDragOver={(event) => {
              if (!event.dataTransfer?.types.includes("Files")) return;
              event.preventDefault();
              event.dataTransfer.dropEffect = "copy";
              setGuidedDragActive(true);
            }}
            onDragLeave={() => setGuidedDragActive(false)}
            onDrop={(event) => {
              if (!event.dataTransfer?.files.length) return;
              event.preventDefault();
              setGuidedDragActive(false);
              addGuidedAttachments(Array.from(event.dataTransfer.files));
            }}
          >
            {guidedAttachments.length > 0 && (
              <ul className="mx-auto mb-2 flex max-w-3xl flex-wrap gap-2">
                {guidedAttachments.map((file, index) => (
                  <li
                    key={`${file.name}-${file.size}-${file.lastModified}`}
                    className="flex items-center gap-2 rounded-lg border border-current/20 bg-midground/5 px-2 py-1 text-xs text-text-secondary"
                  >
                    <Paperclip className="h-3 w-3 shrink-0" />
                    <span className="max-w-[16rem] truncate text-text-primary">
                      {file.name}
                    </span>
                    <span className="opacity-70">
                      {formatAttachmentSize(file.size)}
                    </span>
                    <button
                      type="button"
                      aria-label={`Remove ${file.name}`}
                      className="rounded p-0.5 hover:text-midground"
                      disabled={guidedAttachBusy}
                      onClick={() => removeGuidedAttachment(index)}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {(guidedReadyTimedOut ||
              ptyState === "closed" ||
              ptyState === "ended") && (
              <div
                role="alert"
                className="mx-auto mb-2 flex max-w-3xl flex-wrap items-center justify-between gap-3 rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-text-primary"
              >
                <span>
                  {lastCloseCode === 4401
                    ? "Your dashboard session needs to be refreshed before messages can be sent."
                    : "Lyra’s project connection stopped before it became ready. Your saved project conversation is still available."}
                </span>
                <Button
                  outlined
                  onClick={() => {
                    if (lastCloseCode === 4401) {
                      window.location.reload();
                    } else {
                      startFreshPty();
                    }
                  }}
                >
                  {lastCloseCode === 4401
                    ? "Reload Lyra"
                    : "Restart project chat"}
                </Button>
              </div>
            )}
            <div
              className={cn(
                "mx-auto flex max-w-3xl items-end gap-2 rounded-xl border bg-midground/5 p-2 focus-within:border-midground/50",
                guidedDragActive
                  ? "border-midground/60 bg-midground/10"
                  : "border-current/20",
              )}
            >
              <input
                ref={guidedFileInputRef}
                type="file"
                multiple
                accept={attachmentAccept(
                  guidedModelCaps,
                  CHAT_ATTACHMENT_ACCEPT,
                )}
                className="sr-only"
                onChange={(event) => {
                  addGuidedAttachments(Array.from(event.target.files ?? []));
                  event.target.value = "";
                }}
              />
              <Button
                ghost
                size="icon"
                aria-label="Attach files or images"
                title="Attach files or images"
                disabled={guidedAttachBusy}
                onClick={() => guidedFileInputRef.current?.click()}
              >
                <Paperclip className="h-4 w-4" />
              </Button>
              <textarea
                value={guidedInput}
                onChange={(event) => setGuidedInput(event.target.value)}
                onPaste={(event) => {
                  const files = Array.from(
                    event.clipboardData?.files ?? [],
                  ).filter((file) => file.type.startsWith("image/"));
                  if (!files.length) return;
                  event.preventDefault();
                  addGuidedAttachments(files);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    sendGuidedMessage();
                  }
                }}
                rows={2}
                placeholder={
                  !guidedAgentReady
                    ? "Preparing the project conversation…"
                    : guidedModelReview
                      ? "Choose replacement agent models before continuing…"
                    : guidedPaused
                      ? "Workers are paused—keep talking to Lyra…"
                    : "Describe your idea or ask Lyra what to do next…"
                }
                className="max-h-56 min-h-16 flex-1 resize-y bg-transparent px-2 py-2 text-sm text-text-primary outline-none placeholder:text-text-secondary"
                aria-label="Message Lyra"
              />
              <Button
                size="icon"
                onClick={sendGuidedMessage}
                disabled={
                  !guidedAgentReady ||
                  Boolean(guidedModelReview) ||
                  guidedAttachBusy ||
                  (!guidedInput.trim() && !guidedAttachments.length) ||
                  ptyState !== "open"
                }
                aria-label="Send message"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <p className="mx-auto mt-1.5 max-w-3xl px-2 text-xs text-text-secondary">
              {guidedModelReview
                ? "Open Agents and choose each highlighted replacement model."
                : guidedAttachBusy
                ? "Uploading attachments…"
                : (attachmentCapabilityNotice(guidedModelCaps) ??
                  "Attach files or images with the clip, drag them here, or paste a screenshot. Shift+Enter for a new line.")}
            </p>
          </div>
        </div>
        {guidedPreviewOpen && (
          <GuidedAppPreview
            workspace={workspaceParam}
            projectName={projectName}
            canSend={
              guidedAgentReady &&
              !guidedModelReview &&
              ptyState === "open"
            }
            onClose={() => setGuidedPreviewOpen(false)}
            onSendFeedback={(prompt, display) =>
              submitGuidedText(prompt, display, { applyAgentRouting: false })
            }
            className="fixed inset-3 z-40 overflow-hidden rounded-xl border border-current/20 lg:static lg:z-auto lg:w-[min(42vw,700px)] lg:min-w-[440px] lg:shrink-0 lg:rounded-none lg:border-y-0 lg:border-r-0"
          />
        )}
        <aside
          aria-label="Project progress map"
          className={cn(
            "w-60 shrink-0 overflow-hidden border-l border-current/10 bg-midground/[0.025]",
            guidedPreviewOpen ? "hidden 2xl:flex" : "hidden xl:flex",
          )}
        >
          <GuidedProgressMap
            durable={guidedLedgerSteps !== null}
            steps={guidedPhaseSteps}
          />
        </aside>
        </div>
        </div>
      )}

      <div
        className={cn(
        "min-h-0 flex-1 flex-col gap-2 lg:flex-row lg:gap-3",
        guided
          ? "pointer-events-none fixed -left-[2400px] top-0 flex h-[720px] w-[1100px] opacity-0"
          : "flex",
      )}
        aria-hidden={guided}
      >
        <div
          className={cn(
            "relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg",
            "p-2 sm:p-3",
          )}
          style={{
            backgroundColor: terminalBg,
            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
          }}
        >
          <div
            ref={hostRef}
            className="hermes-chat-xterm-host min-h-0 min-w-0 flex-1"
          />

          {showReconnectOverlay && (
            <div className="absolute inset-x-3 top-3 z-20 flex justify-center sm:inset-x-auto sm:right-3 sm:justify-end">
              <div className="flex max-w-[min(28rem,calc(100vw-3rem))] flex-col items-start gap-2 border border-warning/60 bg-black/80 px-3 py-2 text-xs text-warning shadow-lg">
                <div className="tracking-wide">
                  {ptyState === "reconnecting"
                    ? "Chat is reconnecting."
                    : "Chat disconnected."}
                </div>
                <Button
                  size="sm"
                  outlined
                  onClick={reconnectPty}
                  prefix={<RotateCcw className="h-4 w-4" />}
                  aria-label="Reconnect chat"
                >
                  Reconnect now
                </Button>
              </div>
            </div>
          )}

          {/* NS-504: the agent process exited (e.g. `/exit` or a new session).
              Offer an in-place restart so the user never has to refresh the
              whole page to get a working chat back. */}
          {ptyState === "ended" && (
            <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-black/60">
              <div className="text-sm tracking-wide text-white/80">
                Session ended.
              </div>
              <Button
                onClick={startFreshPty}
                prefix={<RotateCcw className="h-4 w-4" />}
                aria-label="Start a new chat session"
              >
                Start new session
              </Button>
            </div>
          )}

          <Button
            ghost
            onClick={handleCopyLast}
            title="Copy last assistant response as raw markdown"
            aria-label="Copy last assistant response"
            className={cn(
              "absolute z-10",
              "normal-case tracking-normal font-normal",
              "rounded border border-current/30",
              "bg-black/20",
              "opacity-70 hover:opacity-100 hover:border-current/60",
              "transition-opacity duration-150",
              "bottom-2 right-2 px-2 py-1 text-xs sm:bottom-3 sm:right-3 sm:px-2.5 sm:py-1.5",
              "lg:bottom-4 lg:right-4",
            )}
            style={{ color: terminalFg }}
          >
            <span className="inline-flex items-center gap-1.5">
              <Copy className="h-3 w-3 shrink-0" />
              <span className="hidden min-[400px]:inline tracking-wide">
                {copyState === "copied" ? "copied" : "copy last response"}
              </span>
            </span>
          </Button>
        </div>

        {!narrow && !guided && (
          <div
            id="chat-side-panel"
            role="complementary"
            aria-label={modelToolsLabel}
            className="flex min-h-0 shrink-0 flex-col gap-3 overflow-hidden lg:h-full lg:w-60"
          >
            {/* Model picker — keeps the rail thin. */}
            <div className="shrink-0">
              <ChatSidebar
                channel={channel}
                profile={scopedProfile}
                onDashboardNewSessionRequest={startFreshDashboardChat}
                onSessionTitleChange={handleSessionTitleChange}
              />
            </div>

            {/* Session switcher fills the remaining height below the model box. */}
            <div className="min-h-0 flex-1 overflow-hidden">
              <ChatSessionList
                activeSessionId={resumeParam}
                profile={scopedProfile}
                onNewChat={startFreshDashboardChat}
              />
            </div>
          </div>
        )}
      </div>
      <PluginSlot name="chat:bottom" />
    </div>
  );
}

declare global {
  interface Window {
    __IDRAK_IT_SESSION_TOKEN__?: string;
    __IDRAK_IT_AUTH_REQUIRED__?: boolean;
  }
}
