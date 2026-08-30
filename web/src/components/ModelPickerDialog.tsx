import { Button } from "@nous-research/ui/ui/components/button";
import { Checkbox } from "@nous-research/ui/ui/components/checkbox";
import { ListItem } from "@nous-research/ui/ui/components/list-item";
import { Spinner } from "@nous-research/ui/ui/components/spinner";
import { Input } from "@nous-research/ui/ui/components/input";
import { Label } from "@nous-research/ui/ui/components/label";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import type { GatewayClient } from "@/lib/gatewayClient";
import { Check, RefreshCw, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn, themedBody } from "@/lib/utils";
import { fuzzyRank } from "@/lib/fuzzy";
import {
  bestProviderForQuery,
  queryMatchesProviderOnly,
} from "@/lib/model-picker-filter";
import type { ModelOptionProvider, ModelOptionsResponse } from "@/lib/api";

/**
 * Two-stage model picker modal.
 *
 * Mirrors ui-tui/src/components/modelPicker.tsx:
 *   Stage 1: pick provider (authenticated providers only)
 *   Stage 2: pick model within that provider
 *
 * Two invocation modes:
 *
 * 1. Chat-session mode (ChatSidebar) — pass `gw` + `sessionId`. The picker
 *    loads options via `model.options` JSON-RPC and applies the choice via
 *    `config.set`, so expensive-model confirmation can happen before switch.
 *
 * 2. Standalone mode (ModelsPage, Config settings) — pass a `loader` and
 *    `onApply`. The picker fetches options via the REST endpoint and calls
 *    `onApply(provider, model, persistGlobal)` instead of emitting a slash
 *    command.  This lets the Models page reuse the same UI without
 *    requiring an open chat PTY.
 */

interface ExpensiveModelConfirmResponse {
  confirm_message?: string;
  confirm_required?: boolean;
  warning?: string;
}

interface ConfigSetResponse extends ExpensiveModelConfirmResponse {
  value?: string;
}

interface PendingExpensiveConfirm {
  message: string;
  model: string;
  persistGlobal: boolean;
  provider: string;
}

interface Props {
  /** Chat-mode: when present, picker emits a slash command via onSubmit. */
  gw?: GatewayClient;
  sessionId?: string;
  onSubmit?(slashCommand: string): void;

  /** Standalone-mode: when present (and onSubmit absent), picker calls onApply. */
  loader?(options?: { refresh?: boolean }): Promise<ModelOptionsResponse>;
  onApply?(args: {
    confirmExpensiveModel?: boolean;
    provider: string;
    model: string;
    persistGlobal: boolean;
  }):
    | Promise<ExpensiveModelConfirmResponse | void>
    | ExpensiveModelConfirmResponse
    | void;

  onClose(): void;
  title?: string;
  /** If true, hides "Persist globally" checkbox — always saves to config.yaml. */
  alwaysGlobal?: boolean;
}

export function ModelPickerDialog(props: Props) {
  const {
    gw,
    sessionId,
    onSubmit,
    loader,
    onApply,
    onClose,
    title = "Switch Model",
    alwaysGlobal = false,
  } = props;
  const standalone = !!loader && !!onApply;

  const [providers, setProviders] = useState<ModelOptionProvider[]>([]);
  const [currentModel, setCurrentModel] = useState("");
  const [currentProviderSlug, setCurrentProviderSlug] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSlug, setSelectedSlug] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [query, setQuery] = useState("");
  const [persistGlobal, setPersistGlobal] = useState(alwaysGlobal);
  const [applying, setApplying] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingConfirm, setPendingConfirm] =
    useState<PendingExpensiveConfirm | null>(null);
  const closedRef = useRef(false);
  const lastAutoSelectedQueryRef = useRef("");

  const applyOptions = (r: ModelOptionsResponse) => {
    const next = r?.providers ?? [];
    setProviders(next);
    setCurrentModel(String(r?.model ?? ""));
    setCurrentProviderSlug(String(r?.provider ?? ""));
    setSelectedSlug((prev) => {
      if (prev && next.some((p) => p.slug === prev)) return prev;
      return (next.find((p) => p.is_current) ?? next[0])?.slug ?? "";
    });
    setSelectedModel("");
  };

  const requestOptions = (refresh = false) =>
    standalone
      ? (loader as (options?: { refresh?: boolean }) => Promise<ModelOptionsResponse>)({
          refresh,
        })
      : (gw as GatewayClient).request<ModelOptionsResponse>(
          "model.options",
          {
            ...(sessionId ? { session_id: sessionId } : {}),
            ...(refresh ? { refresh: true } : {}),
            // Dashboard picker mirrors the TUI: full provider universe with
            // setup warnings. The backend now defaults to the configured
            // subset (#56974), so opt into unconfigured rows explicitly.
            include_unconfigured: true,
          },
        );

  const refreshOptions = () => {
    setError(null);
    setRefreshing(true);

    requestOptions(true)
      .then((r) => {
        if (closedRef.current) return;
        applyOptions(r);
      })
      .catch((e) => {
        if (closedRef.current) return;
        setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (closedRef.current) return;
        setRefreshing(false);
      });
  };

  // Load providers + models on open.
  useEffect(() => {
    closedRef.current = false;

    requestOptions()
      .then((r) => {
        if (closedRef.current) return;
        applyOptions(r);
      })
      .catch((e) => {
        if (closedRef.current) return;
        setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (closedRef.current) return;
        setLoading(false);
      });

    return () => {
      closedRef.current = true;
    };
    // Deliberately omit props from deps — stable for the dialog's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Esc closes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const selectedProvider = useMemo(
    () => providers.find((p) => p.slug === selectedSlug) ?? null,
    [providers, selectedSlug],
  );

  const models = useMemo(
    () => selectedProvider?.models ?? [],
    [selectedProvider],
  );

  const trimmedQuery = query.trim();

  // Fuzzy-ranked providers: match on name + slug + the provider's model ids so
  // typing a model name surfaces its provider (preserves the prior behaviour
  // where a model match also revealed its provider).
  const filteredProviders = useMemo(
    () =>
      fuzzyRank(
        providers,
        trimmedQuery,
        (p) => `${p.name} ${p.slug} ${(p.models ?? []).join(" ")}`,
      ).map((r) => r.item),
    [providers, trimmedQuery],
  );

  // Searching used to filter the left column while leaving a now-unrelated
  // provider selected. The screenshot symptom was "oll" showing Ollama rows
  // on the left but searching Anthropic's models on the right. On each new
  // query, select the strongest matching provider once; subsequent manual
  // clicks remain respected.
  useEffect(() => {
    const normalized = trimmedQuery.toLowerCase();
    if (!normalized) {
      lastAutoSelectedQueryRef.current = "";
      return;
    }
    if (
      filteredProviders.length === 0 ||
      lastAutoSelectedQueryRef.current === normalized
    ) {
      return;
    }
    lastAutoSelectedQueryRef.current = normalized;
    const directMatch = bestProviderForQuery(filteredProviders, normalized);
    if (!directMatch) return;
    if (directMatch.slug !== selectedSlug) {
      setSelectedSlug(directMatch.slug);
      setSelectedModel("");
    }
  }, [filteredProviders, selectedSlug, trimmedQuery]);

  // A query that matched the SELECTED provider by name/slug (not its models)
  // located that provider — it shouldn't also hide that provider's models
  // just because their ids don't share a substring with the provider name
  // (e.g. typing "aws" to find "AWS Build" then finding zero of its Claude
  // model ids contain "aws"). Fall back to an unfiltered model list in that
  // case; a query that also matches a model id keeps filtering normally.
  const queryMatchesSelectedProviderOnly = useMemo(
    () => queryMatchesProviderOnly(selectedProvider, models, trimmedQuery),
    [trimmedQuery, selectedProvider, models],
  );

  // Fuzzy-ranked models carrying the matched character positions so the model
  // list can highlight why each entry matched.
  const filteredModels = useMemo(
    () =>
      fuzzyRank(
        models,
        queryMatchesSelectedProviderOnly ? "" : trimmedQuery,
        (m) => m,
      ).map((r) => ({
        model: r.item,
        positions: r.positions,
      })),
    [models, trimmedQuery, queryMatchesSelectedProviderOnly],
  );

  const canConfirm = !!selectedProvider && !!selectedModel && !applying;

  const applySelection = async (
    confirmExpensiveModel = false,
    forced?: PendingExpensiveConfirm,
  ) => {
    const providerSlug = forced?.provider ?? selectedProvider?.slug ?? "";
    const model = forced?.model ?? selectedModel;
    const shouldPersistGlobal = forced?.persistGlobal ?? persistGlobal;

    if (!providerSlug || !model || applying) return;

    if (standalone && onApply) {
      setApplying(true);
      try {
        const result = await onApply({
          confirmExpensiveModel,
          provider: providerSlug,
          model,
          persistGlobal: shouldPersistGlobal,
        });
        if (result?.confirm_required) {
          setPendingConfirm({
            provider: providerSlug,
            model,
            persistGlobal: shouldPersistGlobal,
            message:
              result.confirm_message ||
              result.warning ||
              "This model has unusually high known pricing.",
          });
          return;
        }
        onClose();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setApplying(false);
      }
    } else if (gw && sessionId) {
      setApplying(true);
      try {
        const global = shouldPersistGlobal ? " --global" : "";
        const result = await gw.request<ConfigSetResponse>("config.set", {
          confirm_expensive_model: confirmExpensiveModel,
          key: "model",
          session_id: sessionId,
          value: `${model} --provider ${providerSlug}${global}`,
        });
        if (result?.confirm_required) {
          setPendingConfirm({
            provider: providerSlug,
            model,
            persistGlobal: shouldPersistGlobal,
            message:
              result.confirm_message ||
              result.warning ||
              "This model has unusually high known pricing.",
          });
          return;
        }
        onClose();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setApplying(false);
      }
    } else if (onSubmit) {
      const global = shouldPersistGlobal ? " --global" : "";
      onSubmit(`/model ${model} --provider ${providerSlug}${global}`);
      onClose();
    }
  };

  const confirm = () => {
    if (!canConfirm) return;
    void applySelection();
  };

  // Portal to document.body: the main dashboard column in App.tsx is
  // `relative z-2`, which creates a stacking context that traps fixed
  // descendants below the app sidebar (z-50). Without the portal this
  // modal's z-[100] is scoped to z-2 and the sidebar covers its left
  // edge — visible especially in the Large theme variants where the
  // larger root font widens the dialog into the sidebar's column. See
  // Toast.tsx for the same pattern.
  return createPortal(
    <div
      className="lyra-model-picker-backdrop fixed inset-0 z-[100] flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="model-picker-title"
    >
      <div
        className={cn(
          themedBody,
          "lyra-model-picker relative flex max-h-[86vh] w-full max-w-4xl flex-col overflow-hidden",
        )}
      >
        <Button
          ghost
          size="icon"
          onClick={onClose}
          className="lyra-model-picker-close absolute right-4 top-4 text-muted-foreground hover:text-foreground"
          aria-label="Close"
        >
          <X />
        </Button>

        <header className="lyra-model-picker-header">
          <h2
            id="model-picker-title"
            className="lyra-model-picker-title"
          >
            {title}
          </h2>
          <p className="lyra-model-picker-current">
            <span>Currently using</span>
            <strong>{currentModel || "No model selected"}</strong>
            {currentProviderSlug && ` · ${currentProviderSlug}`}
          </p>
        </header>

        <div className="lyra-model-picker-search-area">
          <div className="lyra-model-picker-search relative">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              placeholder="Search AI services and models…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-11 pl-11 text-sm"
            />
          </div>
        </div>

        <div className="lyra-model-picker-grid">
          <ProviderColumn
            loading={loading}
            error={error}
            providers={filteredProviders}
            total={providers.length}
            selectedSlug={selectedSlug}
            query={trimmedQuery}
            onSelect={(slug) => {
              setSelectedSlug(slug);
              setSelectedModel("");
            }}
          />

          <ModelColumn
            provider={selectedProvider}
            models={filteredModels}
            allModels={models}
            selectedModel={selectedModel}
            currentModel={currentModel}
            currentProviderSlug={currentProviderSlug}
            onSelect={setSelectedModel}
            onConfirm={(m) => {
              setSelectedModel(m);
              void applySelection(false, {
                provider: selectedProvider?.slug ?? "",
                model: m,
                persistGlobal,
                message: "",
              });
            }}
          />
        </div>

        <footer className="lyra-model-picker-footer">
          {alwaysGlobal ? (
            <span className="lyra-model-picker-save-note">
              This choice will be used for new chats and projects.
            </span>
          ) : (
            <div className="lyra-model-picker-save-option">
              <Checkbox
                checked={persistGlobal}
                id="model-picker-persist-global"
                onCheckedChange={(checked) =>
                  setPersistGlobal(checked === true)
                }
              />

              <Label
                className="cursor-pointer text-sm text-muted-foreground"
                htmlFor="model-picker-persist-global"
              >
                Use for all future chats
              </Label>
            </div>
          )}

          <div className="lyra-model-picker-actions">
            <Button
              outlined
              onClick={refreshOptions}
              disabled={applying || loading || refreshing}
            >
              {refreshing ? <Spinner /> : <RefreshCw className="h-3.5 w-3.5" />}
              Check again
            </Button>
            <Button outlined onClick={onClose} disabled={applying}>
              Cancel
            </Button>
            <Button onClick={confirm} disabled={!canConfirm}>
              {applying ? <Spinner /> : "Use this model"}
            </Button>
          </div>
        </footer>
      </div>
      <ConfirmDialog
        open={!!pendingConfirm}
        title="Expensive Model Warning"
        description={pendingConfirm?.message}
        destructive
        confirmLabel="Switch anyway"
        cancelLabel="Cancel"
        loading={applying}
        onCancel={() => setPendingConfirm(null)}
        onConfirm={() => {
          const pending = pendingConfirm;
          if (!pending) return;
          setPendingConfirm(null);
          void applySelection(true, pending);
        }}
      />
    </div>,
    document.body,
  );
}

/* ------------------------------------------------------------------ */
/*  Provider column                                                    */
/* ------------------------------------------------------------------ */

function ProviderColumn({
  loading,
  error,
  providers,
  total,
  selectedSlug,
  query,
  onSelect,
}: {
  loading: boolean;
  error: string | null;
  providers: ModelOptionProvider[];
  total: number;
  selectedSlug: string;
  query: string;
  onSelect(slug: string): void;
}) {
  return (
    <section className="lyra-model-picker-providers" aria-label="AI services">
      <div className="lyra-model-picker-column-heading">AI services</div>
      {loading && (
        <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
          <Spinner className="text-xs" /> Loading…
        </div>
      )}

      {error && <div className="p-4 text-xs text-destructive">{error}</div>}

      {!loading && !error && providers.length === 0 && (
        <div className="p-4 text-sm text-muted-foreground">
          {query
            ? "No matches"
            : total === 0
              ? "No connected AI services"
              : "No matches"}
        </div>
      )}

      {providers.map((p) => {
        const active = p.slug === selectedSlug;
        return (
          <ListItem
            key={p.slug}
            active={active}
            data-selected={active}
            onClick={() => onSelect(p.slug)}
            className="lyra-model-picker-provider-row items-start"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-medium truncate">{p.name}</span>
                {p.is_current && <CurrentTag />}
              </div>
              <div className="lyra-model-picker-row-meta">
                {p.total_models ?? p.models?.length ?? 0} models
              </div>
            </div>
          </ListItem>
        );
      })}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Model column                                                       */
/* ------------------------------------------------------------------ */

function ModelColumn({
  provider,
  models,
  allModels,
  selectedModel,
  currentModel,
  currentProviderSlug,
  onSelect,
  onConfirm,
}: {
  provider: ModelOptionProvider | null;
  models: { model: string; positions: number[] }[];
  allModels: string[];
  selectedModel: string;
  currentModel: string;
  currentProviderSlug: string;
  onSelect(model: string): void;
  onConfirm(model: string): void;
}) {
  if (!provider) {
    return (
      <section className="lyra-model-picker-models">
        <div className="lyra-model-picker-column-heading">Models</div>
        <div className="p-4 text-sm text-muted-foreground">
          Choose an AI service first.
        </div>
      </section>
    );
  }

  return (
    <section className="lyra-model-picker-models">
      <div className="lyra-model-picker-column-heading">
        Models from {provider.name}
      </div>
      {provider.warning && (
        <div className="lyra-model-picker-warning">
          {provider.warning}
        </div>
      )}

      {models.length === 0 ? (
        <div className="p-4 text-sm text-muted-foreground">
          {allModels.length
            ? "No models match your search."
            : "No models are available from this service."}
        </div>
      ) : (
        models.map(({ model: m, positions }) => {
          const active = m === selectedModel;
          const isCurrent =
            m === currentModel && provider.slug === currentProviderSlug;

          return (
            <ListItem
              key={m}
              active={active}
              data-selected={active}
              onClick={() => onSelect(m)}
              onDoubleClick={() => onConfirm(m)}
              className="lyra-model-picker-model-row"
            >
              <Check
                className={`h-3 w-3 shrink-0 ${active ? "text-primary" : "text-transparent"}`}
              />
              <span className="flex-1 truncate">
                <HighlightedText text={m} positions={positions} />
              </span>
              {isCurrent && <CurrentTag />}
            </ListItem>
          );
        })
      )}
    </section>
  );
}

function CurrentTag() {
  return (
    <span className="lyra-model-picker-current-tag">
      Current
    </span>
  );
}

/**
 * Render `text` with the characters at `positions` emphasised, so users can
 * see which characters their fuzzy query matched. Positions are indices into
 * `text`; out-of-range indices are ignored.
 */
function HighlightedText({
  text,
  positions,
}: {
  text: string;
  positions: number[];
}) {
  if (!positions.length) {
    return <>{text}</>;
  }

  const hit = new Set(positions);

  return (
    <>
      {Array.from(text).map((ch, i) =>
        hit.has(i) ? (
          <mark
            key={i}
            className="bg-transparent text-primary font-semibold underline underline-offset-2"
          >
            {ch}
          </mark>
        ) : (
          <span key={i}>{ch}</span>
        ),
      )}
    </>
  );
}
