import { Button } from "@nous-research/ui/ui/components/button";
import { Checkbox } from "@nous-research/ui/ui/components/checkbox";
import { ListItem } from "@nous-research/ui/ui/components/list-item";
import { Spinner } from "@nous-research/ui/ui/components/spinner";
import { Input } from "@nous-research/ui/ui/components/input";
import { Label } from "@nous-research/ui/ui/components/label";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { api } from "@/lib/api";
import type { ModelOptionProvider, ModelOptionsResponse } from "@/lib/api";
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
import {
  filterLocalModelServerPresets,
  type LocalModelServerPreset,
} from "@/lib/local-model-servers";

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
  /** Profile to update when adding a local endpoint. */
  profile?: string;
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
    profile,
  } = props;
  const standalone = !!loader && !!onApply;

  const [providers, setProviders] = useState<ModelOptionProvider[]>([]);
  const [currentModel, setCurrentModel] = useState("");
  const [currentProviderSlug, setCurrentProviderSlug] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSlug, setSelectedSlug] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [selectedLocalPreset, setSelectedLocalPreset] =
    useState<LocalModelServerPreset | null>(null);
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
  const filteredLocalPresets = useMemo(
    () => filterLocalModelServerPresets(trimmedQuery),
    [trimmedQuery],
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
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background/85 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="model-picker-title"
    >
      <div className={cn(themedBody, "relative w-full max-w-3xl max-h-[80vh] border border-border bg-card shadow-2xl flex flex-col")}>
        <Button
          ghost
          size="icon"
          onClick={onClose}
          className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
          aria-label="Close"
        >
          <X />
        </Button>

        <header className="p-5 pb-3 border-b border-border">
          <h2
            id="model-picker-title"
            className="font-mondwest text-display text-base tracking-wider"
          >
            {title}
          </h2>
          <p className="text-xs text-muted-foreground mt-1 font-mono">
            current: {currentModel || "(unknown)"}
            {currentProviderSlug && ` · ${currentProviderSlug}`}
          </p>
        </header>

        <div className="px-5 pt-3 pb-2 border-b border-border">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              autoFocus
              placeholder="Filter providers and models…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-7 h-8 text-sm"
            />
          </div>
        </div>

        <div className="flex-1 min-h-0 grid grid-cols-[200px_1fr] overflow-hidden">
          <ProviderColumn
            loading={loading}
            error={error}
            providers={filteredProviders}
            total={providers.length}
            selectedSlug={selectedSlug}
            query={trimmedQuery}
            onSelect={(slug) => {
              setSelectedLocalPreset(null);
              setSelectedSlug(slug);
              setSelectedModel("");
            }}
            localPresets={filteredLocalPresets}
            selectedLocalPresetId={selectedLocalPreset?.id ?? ""}
            onSelectLocal={(preset) => {
              setSelectedLocalPreset(preset);
              setSelectedSlug("");
              setSelectedModel("");
            }}
          />

          {selectedLocalPreset ? (
            <LocalServerSetup
              key={selectedLocalPreset.id}
              preset={selectedLocalPreset}
              profile={profile}
              onSaved={async (providerSlug, model) => {
                const refreshed = await requestOptions(true);
                if (closedRef.current) return;
                applyOptions(refreshed);
                setQuery("");
                setSelectedLocalPreset(null);
                setSelectedSlug(providerSlug);
                setSelectedModel(model);
              }}
            />
          ) : (
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
          )}
        </div>

        <footer className="border-t border-border p-3 flex items-center justify-between gap-3 flex-wrap">
          {alwaysGlobal ? (
            <span className="text-xs text-muted-foreground">
              Saves to config.yaml — applies to new sessions.
            </span>
          ) : (
            <div className="flex items-center gap-2">
              <Checkbox
                checked={persistGlobal}
                id="model-picker-persist-global"
                onCheckedChange={(checked) =>
                  setPersistGlobal(checked === true)
                }
              />

              <Label
                className="font-mondwest normal-case tracking-normal text-xs text-muted-foreground cursor-pointer"
                htmlFor="model-picker-persist-global"
              >
                Persist globally (otherwise this session only)
              </Label>
            </div>
          )}

          <div className="flex items-center gap-2 ml-auto">
            <Button
              outlined
              onClick={refreshOptions}
              disabled={applying || loading || refreshing}
            >
              {refreshing ? <Spinner /> : <RefreshCw className="h-3.5 w-3.5" />}
              Refresh Models
            </Button>
            <Button outlined onClick={onClose} disabled={applying}>
              Cancel
            </Button>
            <Button onClick={confirm} disabled={!canConfirm}>
              {applying ? <Spinner /> : "Switch"}
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
  localPresets,
  selectedLocalPresetId,
  onSelectLocal,
}: {
  loading: boolean;
  error: string | null;
  providers: ModelOptionProvider[];
  total: number;
  selectedSlug: string;
  query: string;
  onSelect(slug: string): void;
  localPresets: LocalModelServerPreset[];
  selectedLocalPresetId: string;
  onSelectLocal(preset: LocalModelServerPreset): void;
}) {
  return (
    <div className="border-r border-border overflow-y-auto">
      {localPresets.length > 0 && (
        <div className="border-b border-border pb-1">
          <div className="px-3 pb-1 pt-2 text-xs text-muted-foreground uppercase tracking-wider">
            Local servers
          </div>
          {localPresets.map((preset) => (
            <ListItem
              key={preset.id}
              active={preset.id === selectedLocalPresetId}
              onClick={() => onSelectLocal(preset)}
              className="items-start text-xs border-l-2 border-l-transparent"
            >
              <div className="min-w-0">
                <div className="font-medium truncate">{preset.name}</div>
                <div className="text-xs text-text-secondary truncate">
                  connect local API
                </div>
              </div>
            </ListItem>
          ))}
        </div>
      )}
      {loading && (
        <div className="flex items-center gap-2 p-4 text-xs text-muted-foreground">
          <Spinner className="text-xs" /> loading…
        </div>
      )}

      {error && <div className="p-4 text-xs text-destructive">{error}</div>}

      {!loading && !error && providers.length === 0 && (
        <div className="p-4 text-xs text-muted-foreground italic">
          {query
            ? "no matches"
            : total === 0
              ? "no authenticated providers"
              : "no matches"}
        </div>
      )}

      {providers.map((p) => {
        const active = p.slug === selectedSlug;
        return (
          <ListItem
            key={p.slug}
            active={active}
            onClick={() => onSelect(p.slug)}
            className={`items-start text-xs border-l-2 ${
              active ? "border-l-primary" : "border-l-transparent"
            }`}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-medium truncate">{p.name}</span>
                {p.is_current && <CurrentTag />}
              </div>
              <div className="text-xs text-text-secondary font-mono truncate">
                {p.slug} · {p.total_models ?? p.models?.length ?? 0} models
              </div>
            </div>
          </ListItem>
        );
      })}
    </div>
  );
}

function LocalServerSetup({
  preset,
  profile,
  onSaved,
}: {
  preset: LocalModelServerPreset;
  profile?: string;
  onSaved(providerSlug: string, model: string): Promise<void>;
}) {
  const [baseUrl, setBaseUrl] = useState(preset.defaultBaseUrl);
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [models, setModels] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);

  const payload = () => ({
    id: preset.id,
    name: preset.name,
    base_url: baseUrl.trim(),
    model: model.trim() || "discover",
    api_key: apiKey.trim() || undefined,
    discover_models: true,
    make_default: false,
    models: models.length ? models : undefined,
  });

  const testConnection = async () => {
    setTesting(true);
    setMessage(null);
    try {
      const result = await api.validateCustomEndpoint(payload(), profile);
      if (!result.ok) {
        setModels([]);
        setMessage(result.message || "Connection test failed.");
        return;
      }
      setModels(result.models);
      if (!model && result.models[0]) setModel(result.models[0]);
      setMessage(
        result.models.length
          ? `Connected — found ${result.models.length} model${result.models.length === 1 ? "" : "s"}.`
          : "Connected, but the server did not list a model. Enter its model ID below.",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setTesting(false);
    }
  };

  const save = async () => {
    if (!baseUrl.trim() || !model.trim()) {
      setMessage("Enter an endpoint URL and select or type a model first.");
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await api.saveCustomEndpoint(
        { ...payload(), model: model.trim() },
        profile,
      );
      await onSaved(preset.id, model.trim());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="overflow-y-auto p-5 space-y-4">
      <div>
        <h3 className="font-medium">Connect {preset.name}</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          {preset.description}
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="local-server-url">OpenAI-compatible URL</Label>
        <Input
          id="local-server-url"
          value={baseUrl}
          onChange={(event) => setBaseUrl(event.target.value)}
          placeholder={preset.defaultBaseUrl}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="local-server-key">API key</Label>
        <Input
          id="local-server-key"
          type="password"
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
          placeholder={
            preset.id === "unsloth-local"
              ? "Paste Unsloth generated API key"
              : "Optional"
          }
          autoComplete="off"
        />
        <p className="text-xs text-muted-foreground">{preset.apiKeyHint}</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="local-server-model">Model</Label>
        {models.length ? (
          <select
            id="local-server-model"
            value={model}
            onChange={(event) => setModel(event.target.value)}
            className="h-9 w-full border border-border bg-background px-3 text-sm"
          >
            {models.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        ) : (
          <Input
            id="local-server-model"
            value={model}
            onChange={(event) => setModel(event.target.value)}
            placeholder="Test connection to discover models, or type a model ID"
          />
        )}
      </div>
      {message && (
        <div className="text-xs text-muted-foreground">{message}</div>
      )}
      <div className="flex gap-2">
        <Button
          outlined
          onClick={() => void testConnection()}
          disabled={testing || saving || !baseUrl.trim()}
        >
          {testing ? <Spinner /> : "Test connection"}
        </Button>
        <Button
          onClick={() => void save()}
          disabled={testing || saving || !baseUrl.trim() || !model.trim()}
        >
          {saving ? <Spinner /> : "Add & select"}
        </Button>
      </div>
      {preset.id === "unsloth-local" && (
        <p className="text-xs text-muted-foreground">
          Keep Unsloth Studio running with a model loaded. Lyra stores the key
          in its secret file, not config.yaml.
        </p>
      )}
    </div>
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
      <div className="overflow-y-auto">
        <div className="p-4 text-xs text-muted-foreground italic">
          pick a provider →
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-y-auto">
      {provider.warning && (
        <div className="p-3 text-xs text-destructive border-b border-border">
          {provider.warning}
        </div>
      )}

      {models.length === 0 ? (
        <div className="p-4 text-xs text-muted-foreground italic">
          {allModels.length
            ? "no models match your filter"
            : "no models listed for this provider"}
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
              onClick={() => onSelect(m)}
              onDoubleClick={() => onConfirm(m)}
              className="px-3 py-1.5 text-xs font-mono"
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
    </div>
  );
}

function CurrentTag() {
  return (
    <span className="text-display text-xs tracking-wider text-primary shrink-0">
      current
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
