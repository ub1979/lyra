import { describe, expect, it } from "vitest";
import {
  EMPTY_REMOTE_SNAPSHOT,
  REMOTE_STEP_ORDER,
  type RemoteSnapshot,
  currentRemoteStep,
  explainRemoteState,
  extractTelegramBotToken,
  isRemoteReady,
  isTelegramBotToken,
  remoteHeadline,
  remoteStepViews,
} from "./remote-setup";

const TOKEN = "123456789:AAG3xKlmNOPqrstuvWXYZ0123456789abcd";

function snapshot(overrides: Partial<RemoteSnapshot> = {}): RemoteSnapshot {
  return { ...EMPTY_REMOTE_SNAPSHOT, ...overrides };
}

const BOT_SAVED = snapshot({ configured: true, enabled: true });
const SERVICE_UP = snapshot({
  configured: true,
  enabled: true,
  gatewayRunning: true,
  state: "connected",
});
const ALL_DONE = snapshot({
  configured: true,
  enabled: true,
  gatewayRunning: true,
  state: "connected",
  homeChatId: "-1001234",
});

describe("isTelegramBotToken", () => {
  it("accepts what BotFather actually hands out", () => {
    expect(isTelegramBotToken(TOKEN)).toBe(true);
    expect(isTelegramBotToken(`  ${TOKEN}  `)).toBe(true);
  });

  it("rejects the things people paste instead", () => {
    expect(isTelegramBotToken("@my_lyra_bot")).toBe(false);
    expect(isTelegramBotToken("my_lyra_bot")).toBe(false);
    expect(isTelegramBotToken("123456789")).toBe(false);
    expect(isTelegramBotToken("123456789:short")).toBe(false);
    expect(isTelegramBotToken("")).toBe(false);
  });
});

describe("extractTelegramBotToken", () => {
  it("finds the token inside BotFather's whole message", () => {
    const message = [
      "Done! Congratulations on your new bot.",
      "Use this token to access the HTTP API:",
      TOKEN,
      "Keep your token secure and store it safely.",
    ].join("\n");
    expect(extractTelegramBotToken(message)).toBe(TOKEN);
  });

  it("returns null when there is no token to find", () => {
    expect(extractTelegramBotToken("I could not find it")).toBeNull();
  });
});

describe("REMOTE_STEP_ORDER", () => {
  it("puts turning the service on before messaging the bot", () => {
    // /sethome is a message TO the bot: it only lands if something is
    // listening. Reversing these two makes step 2 impossible to complete.
    expect(REMOTE_STEP_ORDER.indexOf("service")).toBeLessThan(
      REMOTE_STEP_ORDER.indexOf("phone"),
    );
    expect(REMOTE_STEP_ORDER.indexOf("bot")).toBe(0);
  });
});

describe("currentRemoteStep", () => {
  it("starts at the bot", () => {
    expect(currentRemoteStep(snapshot())).toBe("bot");
  });

  it("moves to the service once the token is saved and enabled", () => {
    expect(currentRemoteStep(BOT_SAVED)).toBe("service");
  });

  it("does not count a saved-but-disabled channel as done", () => {
    expect(currentRemoteStep(snapshot({ configured: true }))).toBe("bot");
  });

  it("waits at the service while the gateway is up but not connected", () => {
    expect(
      currentRemoteStep(
        snapshot({
          configured: true,
          enabled: true,
          gatewayRunning: true,
          state: "pending_restart",
        }),
      ),
    ).toBe("service");
  });

  it("asks for the phone last", () => {
    expect(currentRemoteStep(SERVICE_UP)).toBe("phone");
  });

  it("returns null when there is nothing left to do", () => {
    expect(currentRemoteStep(ALL_DONE)).toBeNull();
  });

  it("re-opens the first broken step, not the last one", () => {
    // A home chat left over from an earlier setup must not make a channel
    // with no credentials look finished.
    const stale = snapshot({ homeChatId: "-1001234" });
    expect(currentRemoteStep(stale)).toBe("bot");
    expect(isRemoteReady(stale)).toBe(false);
  });
});

describe("remoteStepViews", () => {
  it("numbers the steps for a human", () => {
    expect(remoteStepViews(snapshot()).map((s) => s.number)).toEqual([1, 2, 3]);
  });

  it("marks exactly one step current, with the rest done or later", () => {
    const views = remoteStepViews(BOT_SAVED);
    expect(views.map((s) => s.state)).toEqual(["done", "current", "later"]);
  });

  it("marks everything done when the phone is connected", () => {
    expect(remoteStepViews(ALL_DONE).map((s) => s.state)).toEqual([
      "done",
      "done",
      "done",
    ]);
  });

  it("never shows a step title containing jargon", () => {
    const words = remoteStepViews(snapshot())
      .flatMap((s) => [s.title, s.summary])
      .join(" ")
      .toLowerCase();
    for (const jargon of ["gateway", "env", "token", "daemon", "systemd"]) {
      expect(words).not.toContain(jargon);
    }
  });
});

describe("remoteHeadline", () => {
  it("says it plainly when everything works", () => {
    const headline = remoteHeadline(ALL_DONE);
    expect(headline.tone).toBe("ready");
    expect(headline.title).toMatch(/connected/i);
  });

  it("reports its own in-flight work, which the server cannot see", () => {
    expect(remoteHeadline(ALL_DONE, true).tone).toBe("working");
  });

  it("distinguishes 'saved but off' from 'on but waiting for you'", () => {
    expect(remoteHeadline(BOT_SAVED).title).toMatch(/not switched on/i);
    expect(remoteHeadline(SERVICE_UP).title).toMatch(/waiting to hear/i);
  });

  it("surfaces a failed start instead of looking merely unfinished", () => {
    const failed = snapshot({
      configured: true,
      enabled: true,
      state: "startup_failed",
    });
    expect(remoteHeadline(failed).tone).toBe("attention");
    expect(remoteHeadline(failed).title).toMatch(/could not start/i);
  });

  it("opens with an honest estimate when nothing is set up", () => {
    const headline = remoteHeadline(snapshot());
    expect(headline.tone).toBe("idle");
    expect(headline.detail).toMatch(/minutes/);
  });
});

describe("explainRemoteState", () => {
  it("translates every state the API can return", () => {
    for (const state of [
      "connected",
      "pending_restart",
      "gateway_stopped",
      "startup_failed",
      "not_configured",
      "disabled",
      "disconnected",
      "fatal",
    ]) {
      const text = explainRemoteState(state);
      expect(text).not.toBe("Unknown");
      expect(text).not.toContain("_");
    }
  });

  it("does not pretend to know a state it has never seen", () => {
    expect(explainRemoteState("quantum_flux")).toBe("Unknown");
  });
});
