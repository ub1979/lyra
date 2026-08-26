import {
  Bug,
  ExternalLink,
  Laptop,
  LoaderCircle,
  Monitor,
  MousePointer2,
  RefreshCw,
  Send,
  Smartphone,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@nous-research/ui/ui/components/button";

import { cn } from "@/lib/utils";
import { fetchJSON } from "@/lib/api";
import {
  buildVisualFeedbackPrompt,
  normalizePreviewUrl,
  type PreviewConsoleEntry,
  type PreviewElementContext,
} from "@/lib/guided-app-preview";

interface GuidedAppPreviewProps {
  workspace: string;
  projectName: string;
  canSend: boolean;
  onClose: () => void;
  onSendFeedback: (prompt: string, display: string) => void;
  className?: string;
}

interface PreviewDocumentResponse {
  html: string;
  url: string;
  bridge_token: string;
}

interface ViewportPreset {
  id: "fit" | "desktop" | "tablet" | "mobile";
  label: string;
  width: number | null;
  icon: typeof Monitor;
}

const VIEWPORTS: readonly ViewportPreset[] = [
  { id: "fit", label: "Fit", width: null, icon: Monitor },
  { id: "desktop", label: "Desktop", width: 1280, icon: Laptop },
  { id: "tablet", label: "Tablet", width: 768, icon: Monitor },
  { id: "mobile", label: "Mobile", width: 390, icon: Smartphone },
];

function previewStorageKey(workspace: string): string {
  return `lyra:app-preview:url:${workspace || "default"}`;
}

export function GuidedAppPreview({
  workspace,
  projectName,
  canSend,
  onClose,
  onSendFeedback,
  className,
}: GuidedAppPreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [url, setUrl] = useState(() => {
    if (typeof window === "undefined") return "http://127.0.0.1:3000";
    return (
      window.localStorage.getItem(previewStorageKey(workspace)) ??
      "http://127.0.0.1:3000"
    );
  });
  const [resolvedUrl, setResolvedUrl] = useState("");
  const [frameHtml, setFrameHtml] = useState("");
  const [bridgeToken, setBridgeToken] = useState("");
  const [frameKey, setFrameKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectMode, setSelectMode] = useState(true);
  const [viewportId, setViewportId] = useState<ViewportPreset["id"]>("fit");
  const [selected, setSelected] = useState<PreviewElementContext[]>([]);
  const [consoleEntries, setConsoleEntries] = useState<PreviewConsoleEntry[]>([]);
  const [consoleOpen, setConsoleOpen] = useState(false);

  const viewport = useMemo(
    () => VIEWPORTS.find((item) => item.id === viewportId) ?? VIEWPORTS[0],
    [viewportId],
  );

  const loadPreview = useCallback(async () => {
    const normalized = normalizePreviewUrl(url);
    if (!normalized || !workspace) {
      setError("Choose a project and enter its local app URL.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await fetchJSON<PreviewDocumentResponse>(
        "/api/plugins/ultimate-builder/preview/document",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: normalized, workspace }),
        },
      );
      setUrl(response.url);
      setResolvedUrl(response.url);
      setFrameHtml(response.html);
      setBridgeToken(response.bridge_token);
      setFrameKey((value) => value + 1);
      setSelected([]);
      setConsoleEntries([]);
      window.localStorage.setItem(previewStorageKey(workspace), response.url);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setLoading(false);
    }
  }, [url, workspace]);

  const postBridgeMessage = useCallback(
    (message: Record<string, unknown>) => {
      if (!bridgeToken) return;
      iframeRef.current?.contentWindow?.postMessage(
        {
          source: "lyra-app-preview-parent",
          token: bridgeToken,
          ...message,
        },
        "*",
      );
    },
    [bridgeToken],
  );

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      const message = event.data as {
        source?: string;
        token?: string;
        type?: string;
        element?: PreviewElementContext;
        entry?: PreviewConsoleEntry;
      };
      if (
        message?.source !== "lyra-app-preview" ||
        message.token !== bridgeToken
      ) {
        return;
      }
      if (message.type === "element-selected" && message.element) {
        const context = message.element;
        setSelected((current) => {
          const existing = current.find(
            (item) => item.selector === context.selector,
          );
          return existing
            ? current.filter((item) => item.selector !== context.selector)
            : [...current, context];
        });
      } else if (message.type === "console" && message.entry) {
        setConsoleEntries((current) => [
          ...current.slice(-49),
          message.entry as PreviewConsoleEntry,
        ]);
      } else if (message.type === "ready") {
        postBridgeMessage({ type: "mode", selectMode });
        postBridgeMessage({
          type: "selected",
          selectors: selected.map((item) => item.selector),
        });
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [bridgeToken, postBridgeMessage, selectMode, selected]);

  useEffect(() => {
    postBridgeMessage({ type: "mode", selectMode });
  }, [postBridgeMessage, selectMode]);

  useEffect(() => {
    postBridgeMessage({
      type: "selected",
      selectors: selected.map((item) => item.selector),
    });
  }, [postBridgeMessage, selected]);

  const updateComment = (id: string, comment: string) => {
    setSelected((current) =>
      current.map((item) => (item.id === id ? { ...item, comment } : item)),
    );
  };

  const readyToSend =
    canSend && selected.length > 0 && selected.every((item) => item.comment.trim());

  const sendFeedback = () => {
    if (!readyToSend) return;
    const result = buildVisualFeedbackPrompt({
      workspace,
      url: resolvedUrl || normalizePreviewUrl(url),
      viewport: `${viewport.label}${viewport.width ? ` (${viewport.width}px)` : ""}`,
      elements: selected,
      consoleEntries,
    });
    onSendFeedback(result.prompt, result.display);
    setSelected([]);
  };

  return (
    <section
      aria-label="App Preview"
      className={cn(
        "flex min-h-0 min-w-0 flex-col bg-background-base shadow-2xl",
        className,
      )}
    >
      <header className="shrink-0 border-b border-current/10 p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-semibold text-midground">
              <Monitor className="h-4 w-4 text-violet-500" />
              App Preview
            </div>
            <p className="truncate text-[11px] text-text-secondary">
              {projectName} · select rendered elements and tell Lyra what to change
            </p>
          </div>
          <Button ghost size="icon" onClick={onClose} aria-label="Close App Preview">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <form
          className="mt-2 flex gap-1.5"
          onSubmit={(event) => {
            event.preventDefault();
            void loadPreview();
          }}
        >
          <input
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            className="min-w-0 flex-1 rounded-md border border-current/15 bg-midground/[0.04] px-2.5 py-1.5 text-xs text-text-primary outline-none focus:border-violet-500"
            placeholder="http://localhost:3000"
            aria-label="Local app URL"
          />
          <Button size="sm" type="submit" disabled={loading || !workspace}>
            {loading ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : "Open"}
          </Button>
          <Button
            ghost
            size="icon"
            type="button"
            disabled={!frameHtml || loading}
            onClick={() => void loadPreview()}
            aria-label="Reload preview"
            title="Reload after an agent changes the app"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          <Button
            ghost
            size="icon"
            type="button"
            disabled={!normalizePreviewUrl(url)}
            onClick={() => window.open(normalizePreviewUrl(url), "_blank", "noopener,noreferrer")}
            aria-label="Open app in a new tab"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
        </form>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex rounded-md border border-current/10 p-0.5">
            {VIEWPORTS.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={cn(
                    "flex items-center gap-1 rounded px-1.5 py-1 text-[10px]",
                    viewportId === item.id
                      ? "bg-midground text-background-base"
                      : "text-text-secondary hover:bg-midground/5",
                  )}
                  onClick={() => setViewportId(item.id)}
                  title={item.width ? `${item.width}px viewport` : "Fit available space"}
                >
                  <Icon className="h-3 w-3" />
                  <span className="hidden 2xl:inline">{item.label}</span>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            aria-pressed={selectMode}
            className={cn(
              "flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-medium",
              selectMode
                ? "border-violet-500 bg-violet-500/10 text-violet-500"
                : "border-current/15 text-text-secondary",
            )}
            onClick={() => setSelectMode((value) => !value)}
          >
            <MousePointer2 className="h-3.5 w-3.5" />
            {selectMode ? "Select elements" : "Interact with app"}
          </button>
        </div>
      </header>

      <div className="relative min-h-48 flex-1 overflow-auto bg-black/10 p-2">
        {error ? (
          <div role="alert" className="m-auto max-w-sm rounded-lg border border-warning/35 bg-warning/10 p-4 text-sm text-warning">
            <strong className="block text-midground">Preview could not open</strong>
            <span className="mt-1 block break-words text-xs">{error}</span>
            <span className="mt-2 block text-xs text-text-secondary">
              Start the project’s dev server, then enter its localhost URL here.
            </span>
          </div>
        ) : frameHtml ? (
          <iframe
            key={frameKey}
            ref={iframeRef}
            srcDoc={frameHtml}
            title={`${projectName} app preview`}
            sandbox="allow-forms allow-modals allow-popups allow-scripts"
            className="mx-auto block h-full min-h-[320px] border-0 bg-white shadow-lg"
            style={{ width: viewport.width ? `${viewport.width}px` : "100%" }}
          />
        ) : (
          <div className="flex h-full min-h-64 items-center justify-center p-8 text-center">
            <div className="max-w-xs text-text-secondary">
              <Monitor className="mx-auto h-8 w-8 opacity-45" />
              <strong className="mt-3 block text-sm text-midground">
                Open the app Lyra is building
              </strong>
              <span className="mt-1 block text-xs leading-5">
                Enter its local URL. Then click one or several rendered elements and add an instruction for each.
              </span>
            </div>
          </div>
        )}
        {frameHtml && selectMode && (
          <div className="pointer-events-none absolute left-4 top-4 rounded-full bg-violet-600 px-2.5 py-1 text-[10px] font-semibold text-white shadow-lg">
            Selection on · click to add or remove
          </div>
        )}
      </div>

      {(selected.length > 0 || consoleEntries.length > 0) && (
        <div className="max-h-[46%] shrink-0 overflow-y-auto border-t border-current/10 bg-background-base p-3">
          {selected.length > 0 && (
            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <strong className="text-xs text-midground">
                  {selected.length} selected element{selected.length === 1 ? "" : "s"}
                </strong>
                <button
                  type="button"
                  className="flex items-center gap-1 text-[10px] text-text-secondary hover:text-midground"
                  onClick={() => setSelected([])}
                >
                  <Trash2 className="h-3 w-3" /> Clear
                </button>
              </div>
              <div className="space-y-2">
                {selected.map((element, index) => (
                  <div key={element.id} className="rounded-lg border border-violet-500/25 bg-violet-500/[0.04] p-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate font-mono text-[10px] font-semibold text-violet-500">
                          {index + 1}. {element.selector}
                        </div>
                        <div className="mt-0.5 truncate text-[10px] text-text-secondary">
                          {element.text || `<${element.tag}>`} · {element.rect.width}×{element.rect.height}px
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelected((current) => current.filter((item) => item.id !== element.id))}
                        aria-label={`Remove ${element.selector}`}
                        className="text-text-secondary hover:text-midground"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <textarea
                      value={element.comment}
                      onChange={(event) => updateComment(element.id, event.target.value)}
                      rows={2}
                      className="mt-2 w-full resize-y rounded-md border border-current/15 bg-background-base px-2 py-1.5 text-xs text-text-primary outline-none focus:border-violet-500"
                      placeholder="Tell Lyra what to change on this element…"
                      aria-label={`Instruction for ${element.selector}`}
                    />
                  </div>
                ))}
              </div>
              <Button
                className="mt-2 w-full"
                size="sm"
                disabled={!readyToSend}
                onClick={sendFeedback}
              >
                <Send className="mr-1.5 h-3.5 w-3.5" />
                Send visual feedback to Lyra
              </Button>
              {!canSend && (
                <p className="mt-1 text-[10px] text-warning">
                  Lyra’s conversation must be connected before feedback can be sent.
                </p>
              )}
            </div>
          )}

          {consoleEntries.length > 0 && (
            <div className={cn("mt-2", selected.length > 0 && "border-t border-current/10 pt-2")}>
              <button
                type="button"
                className="flex w-full items-center justify-between text-[11px] text-text-secondary"
                onClick={() => setConsoleOpen((value) => !value)}
                aria-expanded={consoleOpen}
              >
                <span className="flex items-center gap-1.5">
                  <Bug className="h-3.5 w-3.5" />
                  Console · {consoleEntries.length} warning{consoleEntries.length === 1 ? "" : "s/errors"}
                </span>
                <span>{consoleOpen ? "Hide" : "Show"}</span>
              </button>
              {consoleOpen && (
                <div className="mt-2 max-h-28 space-y-1 overflow-y-auto rounded-md bg-black/85 p-2 font-mono text-[10px] text-white/80">
                  {consoleEntries.map((entry, index) => (
                    <div key={`${entry.at}-${index}`} className={entry.level === "error" ? "text-red-300" : "text-amber-200"}>
                      [{entry.level}] {entry.message}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
