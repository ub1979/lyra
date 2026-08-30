import {
  BrainCircuit,
  Download,
  GitBranch,
  History,
  LoaderCircle,
  MessageSquareText,
  RotateCcw,
  ShieldCheck,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Markdown } from "@/components/Markdown";
import { useModalBehavior } from "@/hooks/useModalBehavior";
import {
  api,
  authedFetch,
  type UltimateBuilderHistory,
  type UltimateBuilderRecoveryPoint,
} from "@/lib/api";
import { cn, themedBody } from "@/lib/utils";

interface GuidedProjectHistoryProps {
  busy: boolean;
  currentSessionId?: string;
  onBranch: () => void;
  onClose: () => void;
  onRestore: (checkpoint: UltimateBuilderRecoveryPoint) => void;
  onResume: (sessionId: string) => void;
  open: boolean;
  profile?: string;
  workspace: string;
}

function historyTime(value: string | number): string {
  const date =
    typeof value === "number" ? new Date(value * 1000) : new Date(value);
  if (Number.isNaN(date.getTime())) return "Saved recently";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function recoverySummary(point: UltimateBuilderRecoveryPoint): string {
  if (!point.files_changed) return "Project files saved";
  const files = `${point.files_changed} ${point.files_changed === 1 ? "file" : "files"}`;
  const changes = point.insertions + point.deletions;
  return changes ? `${files} · ${changes} changes` : files;
}

function brainStatus(freshness: UltimateBuilderHistory["brain"]["freshness"]): {
  detail: string;
  label: string;
  tone: string;
} {
  switch (freshness) {
    case "current":
      return {
        label: "Memory is current",
        detail: "Verified against the latest saved project version.",
        tone: "bg-emerald-500/10 text-emerald-500",
      };
    case "working_changes":
      return {
        label: "Work is still changing",
        detail: "Lyra will refresh this memory when the current work is saved.",
        tone: "bg-amber-500/10 text-amber-500",
      };
    case "needs_update":
      return {
        label: "Memory needs an update",
        detail: "The project changed after this memory was last saved.",
        tone: "bg-amber-500/10 text-amber-500",
      };
    case "too_large":
      return {
        label: "Memory needs condensing",
        detail: "Lyra will shorten it safely during the next project task.",
        tone: "bg-amber-500/10 text-amber-500",
      };
    case "not_committed":
      return {
        label: "Memory is not saved yet",
        detail: "It will become verifiable with the next local project save.",
        tone: "bg-sky-500/10 text-sky-500",
      };
    default:
      return {
        label: "Memory will be created automatically",
        detail: "Lyra will build it when it next completes project work.",
        tone: "bg-sky-500/10 text-sky-500",
      };
  }
}

export function GuidedProjectHistory({
  busy,
  currentSessionId,
  onBranch,
  onClose,
  onRestore,
  onResume,
  open,
  profile,
  workspace,
}: GuidedProjectHistoryProps) {
  const [history, setHistory] = useState<UltimateBuilderHistory | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"brain" | "recovery" | "conversations">(
    "brain",
  );
  const [restorePoint, setRestorePoint] =
    useState<UltimateBuilderRecoveryPoint | null>(null);
  const [exportingId, setExportingId] = useState("");
  const dialogRef = useModalBehavior<HTMLElement>({ open, onClose });

  useEffect(() => {
    if (!open || !workspace) return;
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      setLoading(true);
      setError("");
    });
    api
      .getUltimateBuilderHistory(workspace)
      .then((value) => {
        if (active) setHistory(value);
      })
      .catch((reason: unknown) => {
        if (active) {
          setError(
            reason instanceof Error
              ? reason.message
              : "Project history could not be loaded.",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open, workspace]);

  const projectName = useMemo(
    () => workspace.split(/[\\/]/).filter(Boolean).at(-1) ?? "this project",
    [workspace],
  );

  const exportConversation = async (id: string, title: string) => {
    setExportingId(id);
    setError("");
    try {
      const response = await authedFetch(api.exportSessionUrl(id, profile));
      if (!response.ok) throw new Error("Conversation export failed.");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${title || projectName}-conversation.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Conversation export failed.",
      );
    } finally {
      setExportingId("");
    }
  };

  if (!open) return null;

  return (
    <>
      {createPortal(
        <div className="lyra-studio-dialog-layer fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-6">
          <button
            type="button"
            className="lyra-studio-dialog-backdrop absolute inset-0"
            aria-label="Close project history"
            onClick={onClose}
          />
          <section
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="project-history-title"
            className={cn(
              themedBody,
              "lyra-studio-panel relative flex h-[min(760px,calc(100dvh-1.5rem))] w-full max-w-4xl flex-col overflow-hidden rounded-[28px] border border-current/15 bg-background-base shadow-2xl sm:h-[min(760px,calc(100dvh-3rem))]",
            )}
          >
            <header className="flex shrink-0 items-start justify-between gap-4 border-b border-current/10 px-5 py-5 sm:px-7">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-midground">
                  <History className="h-5 w-5 shrink-0" />
                  <h2
                    id="project-history-title"
                    className="truncate text-xl font-semibold"
                  >
                    Project memory & history
                  </h2>
                </div>
                <p className="mt-1 text-sm leading-5 text-text-secondary">
                  See what Lyra remembers, return to an earlier version, or
                  continue a saved conversation.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close project history"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-text-secondary transition hover:bg-current/10 hover:text-midground"
              >
                <X className="h-5 w-5" />
              </button>
            </header>

            <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-current/10 px-5 py-3 sm:px-7">
              <div className="flex w-full overflow-x-auto rounded-full bg-current/[0.06] p-1 sm:w-auto">
                <button
                  type="button"
                  onClick={() => setTab("brain")}
                  className={cn(
                    "shrink-0 rounded-full px-4 py-2 text-sm transition",
                    tab === "brain"
                      ? "bg-midground text-background-base shadow-sm"
                      : "text-text-secondary hover:text-midground",
                  )}
                >
                  Project Brain
                </button>
                <button
                  type="button"
                  onClick={() => setTab("recovery")}
                  className={cn(
                    "shrink-0 rounded-full px-4 py-2 text-sm transition",
                    tab === "recovery"
                      ? "bg-midground text-background-base shadow-sm"
                      : "text-text-secondary hover:text-midground",
                  )}
                >
                  Recovery points
                </button>
                <button
                  type="button"
                  onClick={() => setTab("conversations")}
                  className={cn(
                    "shrink-0 rounded-full px-4 py-2 text-sm transition",
                    tab === "conversations"
                      ? "bg-midground text-background-base shadow-sm"
                      : "text-text-secondary hover:text-midground",
                  )}
                >
                  Conversations
                </button>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-500">
                <ShieldCheck className="h-4 w-4" />
                Automatic protection is on
              </span>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7">
              {loading && (
                <div className="grid min-h-48 place-items-center text-text-secondary">
                  <LoaderCircle className="h-6 w-6 animate-spin" />
                </div>
              )}
              {error && (
                <p
                  role="alert"
                  className="mb-4 rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-400"
                >
                  {error}
                </p>
              )}

              {!loading && tab === "brain" && history?.brain && (
                <div className="space-y-4">
                  {(() => {
                    const status = brainStatus(history.brain.freshness);
                    return (
                      <div className="flex flex-col gap-4 rounded-3xl bg-midground/[0.07] p-5 sm:flex-row sm:items-center">
                        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-midground/10 text-midground">
                          <BrainCircuit className="h-6 w-6" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <span
                            className={cn(
                              "inline-flex rounded-full px-3 py-1 text-xs font-medium",
                              status.tone,
                            )}
                          >
                            {status.label}
                          </span>
                          <p className="mt-2 text-sm leading-5 text-text-secondary">
                            {status.detail}
                          </p>
                        </div>
                        {history.brain.updated_at && (
                          <span className="shrink-0 text-xs text-text-secondary/80">
                            Updated {historyTime(history.brain.updated_at)}
                          </span>
                        )}
                      </div>
                    );
                  })()}

                  {history.brain.available ? (
                    <article className="overflow-hidden rounded-3xl border border-current/10 bg-current/[0.025]">
                      <div className="border-b border-current/10 px-5 py-4">
                        <strong className="text-text-primary">
                          What Lyra remembers
                        </strong>
                        <p className="mt-1 text-sm text-text-secondary">
                          Goals, architecture, durable decisions, risks, and
                          the next safe actions—linked back to project evidence.
                        </p>
                      </div>
                      <div className="project-brain-content overflow-x-auto px-5 py-5 text-text-primary">
                        <Markdown content={history.brain.content} />
                      </div>
                      <footer className="flex flex-wrap gap-x-4 gap-y-1 border-t border-current/10 px-5 py-3 text-xs text-text-secondary/80">
                        <span>
                          {history.brain.verified_sources.length} key project
                          {history.brain.verified_sources.length === 1
                            ? " source"
                            : " sources"}
                        </span>
                        <span>
                          {Math.ceil(history.brain.bytes / 1024)} KB of 16 KB
                        </span>
                      </footer>
                    </article>
                  ) : (
                    <div className="rounded-3xl border border-dashed border-current/15 p-8 text-center">
                      <BrainCircuit className="mx-auto h-9 w-9 text-midground" />
                      <strong className="mt-3 block text-text-primary">
                        Project Brain is ready to begin
                      </strong>
                      <p className="mx-auto mt-1 max-w-lg text-sm leading-6 text-text-secondary">
                        No setup is needed. Lyra will create verified project
                        memory automatically the next time it completes work
                        here.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {!loading && tab === "recovery" && (
                <div className="space-y-3">
                  {history?.recovery_points.length ? (
                    history.recovery_points.map((point, index) => (
                      <article
                        key={point.hash}
                        className="flex flex-col gap-4 rounded-2xl border border-current/10 bg-current/[0.025] p-4 sm:flex-row sm:items-center"
                      >
                        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-midground/10 text-midground">
                          <RotateCcw className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <strong className="block text-sm text-text-primary">
                            {index === 0
                              ? "Latest safe point"
                              : "Earlier safe point"}
                          </strong>
                          <span className="mt-1 block text-sm text-text-secondary">
                            {historyTime(point.timestamp)} ·{" "}
                            {recoverySummary(point)}
                          </span>
                        </div>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => setRestorePoint(point)}
                          className="rounded-full border border-current/15 px-4 py-2 text-sm font-medium text-midground transition hover:bg-midground/10 disabled:cursor-not-allowed disabled:opacity-45"
                        >
                          Restore this point
                        </button>
                      </article>
                    ))
                  ) : (
                    <div className="rounded-3xl border border-dashed border-current/15 p-8 text-center">
                      <ShieldCheck className="mx-auto h-8 w-8 text-midground" />
                      <strong className="mt-3 block text-text-primary">
                        Protection is ready
                      </strong>
                      <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-text-secondary">
                        Lyra will create the first recovery point automatically
                        before it changes project files.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {!loading && tab === "conversations" && (
                <div className="space-y-3">
                  <div className="mb-5 flex flex-col gap-3 rounded-3xl bg-midground/[0.07] p-5 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1">
                      <strong className="text-text-primary">
                        Want to try a different idea?
                      </strong>
                      <p className="mt-1 text-sm leading-5 text-text-secondary">
                        Start another path while keeping this conversation and
                        its files safe.
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={onBranch}
                      className="inline-flex items-center justify-center gap-2 rounded-full bg-midground px-4 py-2.5 text-sm font-medium text-background-base transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      <GitBranch className="h-4 w-4" />
                      Try another path
                    </button>
                  </div>

                  {history?.conversations.length ? (
                    history.conversations.map((conversation) => {
                      const current = conversation.id === currentSessionId;
                      return (
                        <article
                          key={conversation.id}
                          className="rounded-2xl border border-current/10 bg-current/[0.025] p-4"
                        >
                          <div className="flex items-start gap-3">
                            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-current/[0.06] text-midground">
                              <MessageSquareText className="h-5 w-5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <strong className="truncate text-sm text-text-primary">
                                  {conversation.title}
                                </strong>
                                {current && (
                                  <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-500">
                                    Open now
                                  </span>
                                )}
                              </div>
                              <p className="mt-1 line-clamp-2 text-sm leading-5 text-text-secondary">
                                {conversation.preview ||
                                  "Saved project conversation"}
                              </p>
                              <span className="mt-2 block text-xs text-text-secondary/80">
                                {historyTime(conversation.last_active)} ·{" "}
                                {conversation.message_count} messages
                              </span>
                            </div>
                          </div>
                          <div className="mt-4 flex flex-wrap justify-end gap-2">
                            <button
                              type="button"
                              disabled={exportingId === conversation.id}
                              onClick={() =>
                                void exportConversation(
                                  conversation.id,
                                  conversation.title,
                                )
                              }
                              className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm text-text-secondary transition hover:bg-current/[0.07] hover:text-midground disabled:opacity-45"
                            >
                              {exportingId === conversation.id ? (
                                <LoaderCircle className="h-4 w-4 animate-spin" />
                              ) : (
                                <Download className="h-4 w-4" />
                              )}
                              Save a copy
                            </button>
                            {!current && (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => onResume(conversation.id)}
                                className="rounded-full border border-current/15 px-4 py-2 text-sm font-medium text-midground transition hover:bg-midground/10 disabled:opacity-45"
                              >
                                Open conversation
                              </button>
                            )}
                          </div>
                        </article>
                      );
                    })
                  ) : (
                    <p className="rounded-3xl border border-dashed border-current/15 p-8 text-center text-sm text-text-secondary">
                      This project’s saved conversations will appear here.
                    </p>
                  )}
                </div>
              )}
            </div>
          </section>
        </div>,
        document.body,
      )}

      <ConfirmDialog
        open={Boolean(restorePoint)}
        title="Restore this safe point?"
        description="Project files will return to how they were at this point. Lyra automatically saves the current version first, so you can undo this later."
        confirmLabel="Restore project"
        cancelLabel="Keep current version"
        onCancel={() => setRestorePoint(null)}
        onConfirm={() => {
          if (!restorePoint) return;
          onRestore(restorePoint);
          setRestorePoint(null);
        }}
      />
    </>
  );
}
