/**
 * Getting Lyra onto someone's phone, in the fewest steps that can work.
 *
 * Most people running Lyra are not developers, and the honest version of the
 * old instructions was: create a bot in another app, find your numeric user
 * ID, hand-edit a `.env` file, then open a terminal and run
 * `hermes gateway install`. Every one of those is a place to give up.
 *
 * Only the first is unavoidable — Telegram will not mint a bot token to
 * anything but a human talking to @BotFather. Everything after it happens
 * here: the token is saved, the channel is enabled, the background service is
 * installed and started, and the phone is identified by the user simply
 * messaging their own bot. No user IDs, no config files, no terminal.
 *
 * This module is the state machine only — which step someone is on, and what
 * that step should say. Kept free of React and of `api` so the wording and
 * the ordering can be tested directly, which matters because the ordering is
 * easy to get subtly wrong (see `REMOTE_STEP_ORDER`).
 */

/** The one thing Telegram makes the human do. */
export const BOTFATHER_URL = "https://t.me/BotFather";

/**
 * A Telegram bot token: the bot's numeric id, a colon, then a secret.
 *
 * Mirrors `_TELEGRAM_BOT_TOKEN_RE` in `hermes_cli/web_server.py` so the page
 * can reject a bad paste immediately instead of after a round-trip. People
 * routinely paste the bot's *username*, or the BotFather message around the
 * token, and "Save" silently failing is how they conclude Lyra is broken.
 */
const BOT_TOKEN_RE = /^\d+:[A-Za-z0-9_-]{30,}$/;

export function isTelegramBotToken(value: string): boolean {
  return BOT_TOKEN_RE.test(value.trim());
}

/**
 * Pull a token out of whatever the user pasted.
 *
 * BotFather's reply is a paragraph with the token in the middle of it, and
 * people paste the paragraph. Finding the token is strictly better than
 * telling them they pasted wrong.
 */
export function extractTelegramBotToken(pasted: string): string | null {
  const match = pasted.match(/\d+:[A-Za-z0-9_-]{30,}/);
  return match ? match[0] : null;
}

export type RemoteStepId = "bot" | "service" | "phone";

/**
 * The order is not cosmetic and not negotiable.
 *
 * The phone step is `/sethome`, a message sent *to the bot* — which only
 * lands if the gateway is already running to receive it. Putting "choose your
 * phone" before "turn on the connection" produces a step that cannot be
 * completed, and the user sits there messaging a bot that nobody is listening
 * to.
 */
export const REMOTE_STEP_ORDER: readonly RemoteStepId[] = [
  "bot",
  "service",
  "phone",
];

/** What the page knows about the channel right now. */
export interface RemoteSnapshot {
  /** Required credentials are present. */
  configured: boolean;
  /** The channel is switched on in config. */
  enabled: boolean;
  /** A gateway process is alive. */
  gatewayRunning: boolean;
  /** The platform's own connection state, e.g. "connected". */
  state: string;
  /** Home chat id — set by the user sending /sethome from their phone. */
  homeChatId: string | null;
}

export const EMPTY_REMOTE_SNAPSHOT: RemoteSnapshot = {
  configured: false,
  enabled: false,
  gatewayRunning: false,
  state: "not_configured",
  homeChatId: null,
};

function botDone(snapshot: RemoteSnapshot): boolean {
  return snapshot.configured && snapshot.enabled;
}

function serviceDone(snapshot: RemoteSnapshot): boolean {
  return snapshot.gatewayRunning && snapshot.state === "connected";
}

function phoneDone(snapshot: RemoteSnapshot): boolean {
  return Boolean(snapshot.homeChatId);
}

const STEP_DONE: Record<RemoteStepId, (s: RemoteSnapshot) => boolean> = {
  bot: botDone,
  service: serviceDone,
  phone: phoneDone,
};

/** True once every step is behind the user. */
export function isRemoteReady(snapshot: RemoteSnapshot): boolean {
  return REMOTE_STEP_ORDER.every((id) => STEP_DONE[id](snapshot));
}

/**
 * The first step that is not finished — where the page should focus.
 *
 * Returns null when everything is done. Deliberately walks the steps in
 * order rather than trusting a later step's "done": a running service with a
 * home chat but no credentials is a stale reading, not a finished setup.
 */
export function currentRemoteStep(snapshot: RemoteSnapshot): RemoteStepId | null {
  for (const id of REMOTE_STEP_ORDER) {
    if (!STEP_DONE[id](snapshot)) return id;
  }
  return null;
}

export type RemoteStepState = "done" | "current" | "later";

export interface RemoteStepView {
  id: RemoteStepId;
  /** 1-based, for "Step 2 of 3". */
  number: number;
  title: string;
  /** One line, present tense, no jargon. */
  summary: string;
  state: RemoteStepState;
}

const STEP_COPY: Record<RemoteStepId, { title: string; summary: string }> = {
  bot: {
    title: "Create your private bot",
    summary:
      "Telegram needs you to make the bot yourself. It takes about a minute.",
  },
  service: {
    title: "Turn the connection on",
    summary:
      "Lyra does this part. It keeps running after you close this window, and comes back after a restart.",
  },
  phone: {
    title: "Say hello from your phone",
    summary:
      "Message your bot once so Lyra knows which chat is yours.",
  },
};

/** Every step, in order, each labelled done / current / later. */
export function remoteStepViews(snapshot: RemoteSnapshot): RemoteStepView[] {
  const current = currentRemoteStep(snapshot);
  return REMOTE_STEP_ORDER.map((id, index) => ({
    id,
    number: index + 1,
    title: STEP_COPY[id].title,
    summary: STEP_COPY[id].summary,
    state: STEP_DONE[id](snapshot)
      ? "done"
      : id === current
        ? "current"
        : "later",
  }));
}

export type RemoteTone = "ready" | "working" | "attention" | "idle";

export interface RemoteHeadline {
  tone: RemoteTone;
  title: string;
  detail: string;
}

/**
 * The one-line answer to "is this working?", in words that mean something to
 * someone who has never heard of a gateway.
 *
 * `busy` is the page's own optimistic state while an action it started is
 * still running — the server cannot report it, because the work happens in a
 * detached process.
 */
export function remoteHeadline(
  snapshot: RemoteSnapshot,
  busy: boolean = false,
): RemoteHeadline {
  if (busy) {
    return {
      tone: "working",
      title: "Setting things up…",
      detail: "This usually takes a few seconds.",
    };
  }
  if (isRemoteReady(snapshot)) {
    return {
      tone: "ready",
      title: "Your phone is connected",
      detail: "Message your bot from anywhere and Lyra answers.",
    };
  }
  if (snapshot.state === "startup_failed" || snapshot.state === "fatal") {
    return {
      tone: "attention",
      title: "The connection could not start",
      detail: "The details are below — usually the bot token was mistyped.",
    };
  }
  if (botDone(snapshot) && !serviceDone(snapshot)) {
    return {
      tone: "attention",
      title: "Your bot is saved, but not switched on",
      detail: "One button turns it on and keeps it on.",
    };
  }
  if (serviceDone(snapshot) && !phoneDone(snapshot)) {
    return {
      tone: "attention",
      title: "Almost there — Lyra is waiting to hear from your phone",
      detail: "Open your bot in Telegram and send it a message.",
    };
  }
  return {
    tone: "idle",
    title: "Lyra is not on your phone yet",
    detail: "Three short steps, about two minutes.",
  };
}

/**
 * Plain-language explanation of a platform state code.
 *
 * The raw codes ("pending_restart", "gateway_stopped") are accurate and
 * useless to the people this page is for.
 */
export function explainRemoteState(state: string): string {
  switch (state) {
    case "connected":
      return "Connected";
    case "pending_restart":
      return "Saved — waiting for the connection to pick it up";
    case "gateway_stopped":
      return "Switched off";
    case "startup_failed":
      return "Could not start";
    case "not_configured":
      return "Not set up yet";
    case "disabled":
      return "Turned off";
    case "disconnected":
      return "Lost connection — retrying";
    case "fatal":
      return "Stopped after an error";
    default:
      return "Unknown";
  }
}
