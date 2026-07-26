(function () {
  "use strict";

  const SDK = window.__HERMES_PLUGIN_SDK__;
  if (!SDK || !window.__HERMES_PLUGINS__) return;

  const { React, fetchJSON } = SDK;
  const h = React.createElement;
  const { useCallback, useEffect, useMemo, useState } = SDK.hooks;
  const { Button, Card, CardContent, CardHeader, CardTitle, Badge, Input } =
    SDK.components;

  const PHASES = [
    ["requirements.md", "Requirements"],
    ["plan.md", "Architecture"],
    ["task-graph.md", "Plan"],
    ["README.md", "Build"],
    ["review-report.md", "Review"],
    ["bug-report.md", "QA"],
    ["security-report.md", "Security"],
    ["DEPLOYMENT.md", "Ship"],
  ];

  function App() {
    const [path, setPath] = useState(
      function () {
        try { return localStorage.getItem("ultimate-builder-project") || ""; }
        catch (_) { return ""; }
      },
    );
    const [state, setState] = useState(null);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const refresh = useCallback(async function () {
      if (!path.trim()) {
        setError("Choose an existing project directory.");
        return;
      }
      setLoading(true);
      setError("");
      try {
        const value = await fetchJSON(
          "/api/plugins/ultimate-builder/state?path=" +
            encodeURIComponent(path.trim()),
        );
        setState(value);
        try { localStorage.setItem("ultimate-builder-project", path.trim()); }
        catch (_) {}
      } catch (err) {
        setError(err && err.message ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    }, [path]);

    useEffect(function () {
      if (path) refresh();
    }, []);

    const artifactMap = useMemo(function () {
      const map = {};
      for (const item of (state && state.artifacts) || []) map[item.name] = item;
      return map;
    }, [state]);

    const completed = PHASES.filter(function (phase) {
      return artifactMap[phase[0]] && artifactMap[phase[0]].exists;
    }).length;
    const nextPhase = PHASES.find(function (phase) {
      return !(artifactMap[phase[0]] && artifactMap[phase[0]].exists);
    });

    return h("div", { className: "ub-page" },
      h("section", { className: "ub-hero" },
        h("div", null,
          h("p", { className: "ub-kicker" }, "HERMES · DELIVERY SYSTEM"),
          h("h1", null, "Build software with evidence."),
          h("p", { className: "ub-subtitle" },
            "One agent runtime. Specialist delegates. Visible gates from idea to production."),
        ),
        h("div", { className: "ub-score", "aria-label": completed + " of 8 phases complete" },
          h("strong", null, String(completed).padStart(2, "0")),
          h("span", null, "/ 08 phases"),
        ),
      ),
      h(Card, { className: "ub-project-card" },
        h(CardContent, { className: "ub-project-row" },
          h("div", { className: "ub-input-wrap" },
            h("label", { htmlFor: "ub-project" }, "Project directory"),
            h(Input, {
              id: "ub-project",
              value: path,
              placeholder: "/path/to/your/application",
              onChange: function (event) { setPath(event.target.value); },
              onKeyDown: function (event) { if (event.key === "Enter") refresh(); },
            }),
          ),
          h(Button, { onClick: refresh, disabled: loading },
            loading ? "Inspecting…" : "Inspect project"),
        ),
      ),
      error && h("div", { className: "ub-error", role: "alert" }, error),
      h("section", { className: "ub-pipeline", "aria-label": "Delivery pipeline" },
        PHASES.map(function (phase, index) {
          const done = artifactMap[phase[0]] && artifactMap[phase[0]].exists;
          return h("div", {
            className: "ub-phase " + (done ? "is-done" : "is-pending"),
            key: phase[0],
          },
            h("span", { className: "ub-phase-index" }, String(index + 1).padStart(2, "0")),
            h("strong", null, phase[1]),
            h("span", null, done ? "Verified artifact" : "Waiting"),
          );
        }),
      ),
      h("div", { className: "ub-grid" },
        h(Card, null,
          h(CardHeader, null, h(CardTitle, null, "Current state")),
          h(CardContent, null,
            state
              ? h(React.Fragment, null,
                  h("div", { className: "ub-state-line" },
                    h(Badge, null, state.has_sdlc ? "Tracked" : "Not started"),
                    h("span", null, nextPhase ? "Next: " + nextPhase[1] : "Release gates complete"),
                  ),
                  h("pre", { className: "ub-ledger" },
                    state.progress || "No .sdlc/progress.md yet. Start in Chat with /ultimate-build <brief>."),
                )
              : h("p", { className: "ub-empty" },
                  "Enter a project directory to see its live SDLC ledger."),
          ),
        ),
        h(Card, null,
          h(CardHeader, null, h(CardTitle, null, "Controlled learning")),
          h(CardContent, null,
            h("p", { className: "ub-copy" },
              "Lessons stay quarantined until evidence, regression checks, and human approval agree."),
            state && state.learning_candidates.length
              ? h("div", { className: "ub-candidates" },
                  state.learning_candidates.map(function (item) {
                    return h("div", { className: "ub-candidate", key: item.file },
                      h("div", null, h("strong", null, item.title), h("span", null, item.file)),
                      h(Badge, null, item.status + " · " + item.risk),
                    );
                  }),
                )
              : h("div", { className: "ub-learning-empty" },
                  h("span", null, "0"),
                  h("p", null, "No candidate changes awaiting evaluation."),
                ),
          ),
        ),
      ),
      h("footer", { className: "ub-footer" },
        h("p", null, "Implementation runs in Hermes Chat—no duplicate agent, no reduced tool access."),
        h("a", { href: "/chat" }, "Open Chat →"),
      ),
    );
  }

  window.__HERMES_PLUGINS__.register("ultimate-builder", App);
})();
