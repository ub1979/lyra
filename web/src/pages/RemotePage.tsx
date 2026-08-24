import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  ExternalLink,
  Loader2,
  Send,
  Smartphone,
  TriangleAlert,
} from "lucide-react";

import { Badge } from "@nous-research/ui/ui/components/badge";
import { Button } from "@nous-research/ui/ui/components/button";
import { Card, CardContent } from "@nous-research/ui/ui/components/card";
import { Input } from "@nous-research/ui/ui/components/input";
import { Label } from "@nous-research/ui/ui/components/label";
import { H2 } from "@nous-research/ui/ui/components/typography/h2";

import { api } from "@/lib/api";
import type { MessagingPlatform } from "@/lib/api";
import {
  BOTFATHER_URL,
  EMPTY_REMOTE_SNAPSHOT,
  type RemoteSnapshot,
  type RemoteStepView,
  explainRemoteState,
  extractTelegramBotToken,
  isRemoteReady,
  isTelegramBotToken,
  remoteHeadline,
  remoteStepViews,
} from "@/lib/remote-setup";
import { cn, themedBody } from "@/lib/utils";
import { usePageHeader } from "@/contexts/usePageHeader";

/**
 * Remote — putting Lyra on your phone.
 *
 * The Channels page already does this and will keep doing it: it exposes every
 * platform and every environment variable, which is the right shape for
 * someone who knows what a bot token is. This page is for everyone else. It
 * asks for one thing (the token Telegram will only give a human), then does
 * the remaining work itself — enable the channel, install the background
 * service, start it, and watch until the phone actually answers.
 *
 * Only Telegram today. The layout is a list of channel cards on purpose, so
 * WhatsApp or Discord can be added as a second card without reworking the
 * page.
 */

const POLL_INTERVAL_MS = 4000;

/** How long to keep believing our own optimistic "working" state. */
const BUSY_TIMEOUT_MS = 90_000;

function toSnapshot(platform: MessagingPlatform | null): RemoteSnapshot {
  if (!platform) return EMPTY_REMOTE_SNAPSHOT;
  return {
    configured: platform.configured,
    enabled: platform.enabled,
    gatewayRunning: platform.gateway_running,
    state: platform.state,
    homeChatId: platform.home_channel?.chat_id ?? null,
  };
}

function StepMarker({ step }: { step: RemoteStepView }) {
  if (step.state === "done") {
    return (
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-success/15 text-success"
        aria-hidden="true"
      >
        <Check className="h-4 w-4" />
      </span>
    );
  }
  return (
    <span
      className={cn(
        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
        step.state === "current"
          ? "bg-midground text-background-base"
          : "border border-current/20 text-text-secondary",
      )}
      aria-hidden="true"
    >
      {step.number}
    </span>
  );
}

export default function RemotePage() {
  const { setEnd } = usePageHeader();
  const [platform, setPlatform] = useState<MessagingPlatform | null>(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState("");
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const busySince = useRef<number | null>(null);

  const snapshot = useMemo(() => toSnapshot(platform), [platform]);
  const steps = useMemo(() => remoteStepViews(snapshot), [snapshot]);
  const ready = isRemoteReady(snapshot);
  const headline = remoteHeadline(snapshot, busy);

  /**
   * Retire the optimistic "working" state.
   *
   * Installing and starting the service happens in a detached process, so
   * nothing reports back — the only evidence is the channel turning
   * connected on a later poll. Settled here rather than in an effect so the
   * decision sits next to the reading it is based on, and so a timeout can
   * raise a real message instead of the spinner just stopping.
   */
  const settleBusy = useCallback((telegram: MessagingPlatform | null) => {
    const startedAt = busySince.current;
    if (startedAt === null) return;
    const connected = Boolean(
      telegram && telegram.gateway_running && telegram.state === "connected",
    );
    if (connected) {
      busySince.current = null;
      setBusy(false);
      return;
    }
    if (Date.now() - startedAt > BUSY_TIMEOUT_MS) {
      busySince.current = null;
      setBusy(false);
      setFailure(
        "Turning the connection on is taking longer than expected. " +
          "Check the Channels page for details, or try again.",
      );
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      const response = await api.getMessagingPlatforms();
      const telegram =
        response.platforms.find((entry) => entry.id === "telegram") ?? null;
      setPlatform(telegram);
      settleBusy(telegram);
      return telegram;
    } catch {
      // A single failed poll is not worth a visible error: the page is a live
      // view, and the next tick four seconds from now usually succeeds.
      return null;
    } finally {
      setLoading(false);
    }
  }, [settleBusy]);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    setEnd(
      ready ? (
        <Badge className="bg-success/15 text-success">Connected</Badge>
      ) : null,
    );
    return () => setEnd(null);
  }, [ready, setEnd]);

  /** Save the token, switch the channel on, then bring the service up. */
  const connect = useCallback(async () => {
    const found = extractTelegramBotToken(token);
    if (!found || !isTelegramBotToken(found)) {
      setTokenError(
        "That does not look like a bot token. It should look like " +
          "123456789:AAG… — paste the whole line BotFather sent you.",
      );
      return;
    }
    setTokenError(null);
    setFailure(null);
    setBusy(true);
    busySince.current = Date.now();
    try {
      await api.updateMessagingPlatform("telegram", {
        enabled: true,
        env: { TELEGRAM_BOT_TOKEN: found },
      });
      setToken("");
      await api.installGateway();
      await refresh();
    } catch (error) {
      setBusy(false);
      busySince.current = null;
      setFailure(
        error instanceof Error
          ? error.message
          : "Could not save the bot. Please try again.",
      );
    }
  }, [refresh, token]);

  /** Bring the service up for a channel whose token is already saved. */
  const turnOn = useCallback(async () => {
    setFailure(null);
    setBusy(true);
    busySince.current = Date.now();
    try {
      await api.installGateway();
      await refresh();
    } catch (error) {
      setBusy(false);
      busySince.current = null;
      setFailure(
        error instanceof Error
          ? error.message
          : "Could not turn the connection on.",
      );
    }
  }, [refresh]);

  return (
    <div className={cn("mx-auto max-w-3xl space-y-6 p-6", themedBody)}>
      <header className="space-y-2">
        <H2 className="flex items-center gap-2">
          <Smartphone className="h-5 w-5" />
          Remote
        </H2>
        <p className="text-text-secondary">
          Use Lyra from your phone. Send it work while you are away, and get a
          message back when it needs you.
        </p>
      </header>

      <Card>
        <CardContent className="space-y-5 p-6">
          <div className="flex items-start gap-3">
            {headline.tone === "working" ? (
              <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-text-secondary" />
            ) : headline.tone === "ready" ? (
              <Check className="mt-0.5 h-5 w-5 shrink-0 text-success" />
            ) : headline.tone === "attention" ? (
              <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
            ) : (
              <Send className="mt-0.5 h-5 w-5 shrink-0 text-text-secondary" />
            )}
            <div>
              <div className="font-semibold">{headline.title}</div>
              <div className="text-sm text-text-secondary">
                {headline.detail}
              </div>
            </div>
          </div>

          {failure && (
            <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
              {failure}
            </div>
          )}

          {loading ? (
            <div className="text-sm text-text-secondary">Checking…</div>
          ) : (
            <ol className="space-y-4">
              {steps.map((step) => (
                <li key={step.id} className="flex gap-3">
                  <StepMarker step={step} />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div
                      className={cn(
                        "font-medium",
                        step.state === "later" && "text-text-secondary",
                      )}
                    >
                      {step.title}
                    </div>
                    <div className="text-sm text-text-secondary">
                      {step.summary}
                    </div>

                    {/* Only the step in hand shows controls. Everything else
                        is a label, so there is never a choice of what to
                        click next. */}
                    {step.state === "current" && step.id === "bot" && (
                      <div className="space-y-3 pt-1">
                        <ol className="list-decimal space-y-1 pl-5 text-sm text-text-secondary">
                          <li>
                            Open{" "}
                            <a
                              className="inline-flex items-center gap-1 underline"
                              href={BOTFATHER_URL}
                              target="_blank"
                              rel="noreferrer"
                            >
                              BotFather
                              <ExternalLink className="h-3 w-3" />
                            </a>{" "}
                            in Telegram and press Start.
                          </li>
                          <li>
                            Send it <code>/newbot</code>, then choose any name
                            and a username ending in <code>bot</code>.
                          </li>
                          <li>
                            It replies with a long line starting with numbers.
                            Copy that whole message and paste it below.
                          </li>
                        </ol>
                        <div className="space-y-2">
                          <Label htmlFor="remote-token">
                            Paste BotFather&rsquo;s reply
                          </Label>
                          <Input
                            id="remote-token"
                            type="password"
                            autoComplete="off"
                            spellCheck={false}
                            placeholder="123456789:AAG…"
                            value={token}
                            onChange={(event) => {
                              setToken(event.target.value);
                              if (tokenError) setTokenError(null);
                            }}
                          />
                          {tokenError && (
                            <p className="text-sm text-warning">{tokenError}</p>
                          )}
                          <p className="text-xs text-text-secondary">
                            This stays on your computer. Anyone with it can
                            message as your bot, so do not share it.
                          </p>
                        </div>
                        <Button
                          disabled={busy || token.trim().length === 0}
                          onClick={() => void connect()}
                        >
                          {busy ? "Connecting…" : "Connect my phone"}
                        </Button>
                      </div>
                    )}

                    {step.state === "current" && step.id === "service" && (
                      <div className="pt-1">
                        <Button
                          disabled={busy}
                          onClick={() => void turnOn()}
                        >
                          {busy ? "Turning on…" : "Turn it on"}
                        </Button>
                      </div>
                    )}

                    {step.state === "current" && step.id === "phone" && (
                      <div className="space-y-2 pt-1 text-sm text-text-secondary">
                        <p>
                          Open your bot in Telegram, press Start, then send{" "}
                          <code>/sethome</code>. That tells Lyra which chat to
                          reach you in.
                        </p>
                        <p className="flex items-center gap-2">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Waiting for your message…
                        </p>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}

          {ready && (
            <div className="rounded-lg border border-current/10 bg-midground/5 p-4 text-sm">
              <div className="font-medium">You are set up.</div>
              <p className="text-text-secondary">
                Message your bot from anywhere. Lyra keeps answering after you
                close this window, and starts again by itself after a restart.
              </p>
            </div>
          )}

          {platform && !loading && (
            <div className="border-t border-current/10 pt-3 text-xs text-text-secondary">
              Status: {explainRemoteState(platform.state)}
              {platform.error_message ? ` — ${platform.error_message}` : ""}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-2 p-4 text-left"
            onClick={() => setGuideOpen((open) => !open)}
            aria-expanded={guideOpen}
          >
            <span className="font-medium">Show me everything</span>
            <ChevronDown
              className={cn(
                "h-4 w-4 transition-transform",
                guideOpen && "rotate-180",
              )}
              aria-hidden="true"
            />
          </button>
          {guideOpen && (
            <div className="space-y-4 border-t border-current/10 p-4 text-sm text-text-secondary">
              <section className="space-y-1">
                <h3 className="font-medium text-text-primary">
                  What this actually does
                </h3>
                <p>
                  Telegram will only give a bot to a person, so you create one
                  and paste its token here. Lyra saves it, switches the channel
                  on, and installs a small background service that stays
                  running and relays messages between Telegram and Lyra. That
                  service starts again on its own when you restart the
                  computer.
                </p>
              </section>
              <section className="space-y-1">
                <h3 className="font-medium text-text-primary">
                  Who can talk to my bot?
                </h3>
                <p>
                  Only people you approve. The first time someone new messages
                  it, they get a code and nothing else happens until you
                  approve them on the Pairing page. A bot username is public,
                  so strangers can find it — they just cannot use it.
                </p>
              </section>
              <section className="space-y-1">
                <h3 className="font-medium text-text-primary">
                  It says connected, but there is no reply
                </h3>
                <p>
                  Send <code>/start</code> to the bot first — Telegram does not
                  deliver anything to a bot you have not started. If it is
                  still quiet, check the Pairing page for a request waiting for
                  your approval.
                </p>
              </section>
              <section className="space-y-1">
                <h3 className="font-medium text-text-primary">
                  I pasted the token and nothing happened
                </h3>
                <p>
                  The token is the line that begins with digits and a colon.
                  The bot&rsquo;s <em>username</em> (the @name) is not the
                  token. If BotFather&rsquo;s message was sent long ago you can
                  ask it for the token again with <code>/mybots</code>.
                </p>
              </section>
              <section className="space-y-1">
                <h3 className="font-medium text-text-primary">
                  Turning it off
                </h3>
                <p>
                  Switch Telegram off on the Channels page, or send
                  BotFather <code>/deletebot</code> to destroy the bot
                  entirely.
                </p>
              </section>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
