(function () {
  "use strict";

  const SDK = window.__IDRAK_IT_PLUGIN_SDK__;
  if (!SDK || !window.__IDRAK_IT_PLUGINS__) return;

  const { React, api } = SDK;
  const h = React.createElement;
  const { useCallback, useEffect, useMemo, useState } = SDK.hooks;
  const { Button, Card, CardContent, Input, Badge } = SDK.components;

  const SKILLS = [
    ["req-engineer", "Requirements", "Clarify goals, users, scope, and acceptance criteria."],
    ["spec", "Technical specification", "Turn the request into detailed, testable behavior."],
    ["ui-designer", "Design", "Set the look and feel from real references, then review the build against it."],
    ["sw-architect", "Architecture", "Design the system, data, APIs, and boundaries."],
    ["task-planner", "Task planning", "Create an ordered implementation graph."],
    ["proj-manager", "Project planning", "Build milestones, checkpoints, and delivery plans."],
    ["sw-developer", "Development", "Write and integrate working application code."],
    ["oop-restructurer", "Code restructuring", "Improve modules, classes, and maintainability."],
    ["debugger", "Debugging", "Find root causes and add regression coverage."],
    ["code-reviewer", "Code review", "Review correctness, quality, and maintainability."],
    ["ux-writer", "UX writing", "Write the labels, empty states, and error messages users read."],
    ["qa-engineer", "Quality assurance", "Test real user journeys and report reproducible bugs."],
    ["a11y-auditor", "Accessibility", "Audit against WCAG 2.2 with measured contrast and keyboard paths."],
    ["security-auditor", "Security", "Audit authentication, data, dependencies, and secrets."],
    ["devops-engineer", "Deployment", "Prepare CI/CD, containers, operations, and rollback."],
    ["tech-writer", "Documentation", "Write user, developer, and API documentation."],
    ["benchmark", "Benchmarks", "Measure speed, reliability, and resource usage."],
    ["health", "Health checks", "Record operational health and stability baselines."],
    ["context-save", "Context preservation", "Keep decisions and progress available between sessions."],
    ["learn", "Controlled learning", "Record evidence-backed improvement candidates."],
  ];

  // Requirements is always available (see the app-it playbook). Every path that sets the
  // team goes through this, so no template, Clear, or stray click can drop it.
  const REQUIRED_SKILL_IDS = ["req-engineer"];
  const withRequired = function (ids) {
    const next = new Set(ids);
    REQUIRED_SKILL_IDS.forEach((id) => next.add(id));
    return next;
  };
  const BUILTIN_TEMPLATES = [
    {
      id: "app-it",
      name: "Let Lyra guide me",
      description: "Start with your idea. Lyra asks a few questions and recommends the smallest useful specialist team.",
      skills: [],
      accent: "lime",
    },
    {
      id: "sdlc",
      name: "Full SDLC",
      description: "End-to-end delivery with a focused core team; Lyra recommends extra agents only when the project needs them.",
      skills: ["req-engineer", "sw-architect", "sw-developer", "qa-engineer", "security-auditor", "devops-engineer"],
      accent: "lime",
    },
    {
      id: "mvp",
      name: "MVP",
      description: "A fast path from clear requirements to a useful, tested, documented first release.",
      skills: ["req-engineer", "sw-developer", "qa-engineer", "tech-writer"],
      accent: "coral",
    },
    {
      id: "planning",
      name: "Plan only",
      description: "Requirements, specification, architecture, and project planning—no coding.",
      skills: ["req-engineer", "spec", "sw-architect", "task-planner", "proj-manager", "context-save"],
      accent: "blue",
    },
    {
      id: "review",
      name: "Review & QA",
      description: "Open an existing folder for independent review, testing, debugging, and security.",
      skills: ["code-reviewer", "qa-engineer", "debugger", "security-auditor", "tech-writer"],
      accent: "violet",
    },
  ];

  const CUSTOM_TEMPLATES_KEY = "idrak-it.builder.templates.v1";
  const RECENT_PROJECTS_KEY = "idrak-it.builder.projects.v1";
  const SKILL_MODELS_KEY = "idrak-it.builder.skill-models.v1";

  function readStored(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "null");
      return Array.isArray(value) ? value : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function writeStored(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (_) {}
  }

  function readStoredMap(key) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "null");
      return value && typeof value === "object" && !Array.isArray(value) ? value : {};
    } catch (_) {
      return {};
    }
  }

  function joinPath(parent, name) {
    const separator = parent && parent.includes("\\") && !parent.includes("/") ? "\\" : "/";
    return String(parent || "").replace(/[\\/]+$/, "") + separator + name;
  }

  function defaultProjectsRoot(cwd) {
    const trimmed = String(cwd || "").replace(/[\\/]+$/, "");
    const leaf = trimmed.split(/[\\/]/).filter(Boolean).pop() || "";
    return leaf === "my_projects" ? trimmed : joinPath(trimmed, "my_projects");
  }

  async function requireSafeWorkspace(path) {
    const result = await SDK.fetchJSON(
      "/api/plugins/ultimate-builder/workspace-safety?path=" + encodeURIComponent(path),
    );
    if (!result || !result.allowed) {
      throw new Error((result && result.reason) || "Choose a project folder outside Lyra's application files.");
    }
    return result.path || path;
  }

  function defaultBrief(templateId, existing) {
    if (templateId === "app-it") return existing
      ? "Help me understand this project and decide which agents should work on what I need next."
      : "Help me shape my idea and recommend the smallest useful specialist team.";
    if (templateId === "planning") return "Understand this project and create a clear requirements, architecture, and project plan. Do not implement code.";
    if (templateId === "review") return "Review this existing project, run appropriate QA checks, identify important defects, and recommend verified fixes.";
    if (existing) return "Improve this existing project using the selected agents. Inspect it first, preserve unrelated work, and confirm the plan before broad changes.";
    return "Help me turn my idea into a useful application. Ask concise questions when an important product decision is missing.";
  }

  function DirectoryPicker({ initialPath, onCancel, onSelect }) {
    const [listing, setListing] = useState(null);
    const [path, setPath] = useState(initialPath || "");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(true);

    const load = useCallback(async function (nextPath) {
      setLoading(true);
      setError("");
      try {
        const value = await api.listFiles(nextPath || undefined);
        setListing(value);
        setPath(value.path);
      } catch (err) {
        setError(err && err.message ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    }, []);

    useEffect(function () { load(initialPath); }, []);

    const directories = (listing && listing.entries || []).filter((entry) => entry.is_directory);

    return h("div", { className: "ub-picker", role: "dialog", "aria-label": "Choose project folder" },
      h("div", { className: "ub-picker-head" },
        h("div", null,
          h("strong", null, "Choose a folder"),
          h("span", null, "Only folders are shown."),
        ),
        h(Button, { ghost: true, onClick: onCancel }, "Close"),
      ),
      h("div", { className: "ub-path-row" },
        h(Input, {
          value: path,
          onChange: (event) => setPath(event.target.value),
          onKeyDown: (event) => { if (event.key === "Enter") load(path); },
          "aria-label": "Folder path",
        }),
        h(Button, { outlined: true, onClick: () => load(path) }, "Go"),
      ),
      error && h("div", { className: "ub-error", role: "alert" }, error),
      h("div", { className: "ub-folder-list" },
        listing && listing.parent && h("button", {
          className: "ub-folder",
          type: "button",
          onClick: () => load(listing.parent),
        }, h("span", { className: "ub-folder-icon" }, "↑"), h("span", null, "Parent folder")),
        loading
          ? h("div", { className: "ub-picker-empty" }, "Loading folders…")
          : directories.length
            ? directories.map((entry) => h("button", {
                className: "ub-folder",
                key: entry.path,
                type: "button",
                onClick: () => load(entry.path),
              }, h("span", { className: "ub-folder-icon" }, "⌑"), h("span", null, entry.name)))
            : h("div", { className: "ub-picker-empty" }, "No folders inside this location."),
      ),
      h("div", { className: "ub-picker-actions" },
        h("span", null, listing ? listing.path : ""),
        h(Button, { onClick: () => listing && onSelect(listing.path), disabled: !listing }, "Choose this folder"),
      ),
    );
  }

  function App() {
    const [screen, setScreen] = useState("home");
    const [mode, setMode] = useState("new");
    const [templateId, setTemplateId] = useState("app-it");
    const [selected, setSelected] = useState(withRequired([]));
    const [projectPath, setProjectPath] = useState("");
    const [parentPath, setParentPath] = useState("");
    const [projectName, setProjectName] = useState("");
    const [brief, setBrief] = useState("");
    const [error, setError] = useState("");
    const [starting, setStarting] = useState(false);
    const [pickerTarget, setPickerTarget] = useState("");
    const [customTemplates, setCustomTemplates] = useState(() => readStored(CUSTOM_TEMPLATES_KEY, []));
    const [recentProjects, setRecentProjects] = useState(() => readStored(RECENT_PROJECTS_KEY, []));
    const [templateName, setTemplateName] = useState("");
    const [skillModels, setSkillModels] = useState(() => readStoredMap(SKILL_MODELS_KEY));
    const [modelInfo, setModelInfo] = useState({ provider: "", model: "" });
    const [modelOptions, setModelOptions] = useState([]);
    const [modelsLoading, setModelsLoading] = useState(true);

    const templates = useMemo(
      () => BUILTIN_TEMPLATES.concat(customTemplates.map((template) => ({ ...template, accent: "custom" }))),
      [customTemplates],
    );
    const activeTemplate = templates.find((template) => template.id === templateId) || templates[0];

    useEffect(function () {
      let active = true;
      Promise.all([api.getModelInfo(), api.getModelOptions()])
        .then(([info, options]) => {
          if (!active) return;
          const providers = Array.isArray(options && options.providers) ? options.providers : [];
          const provider = providers.find((item) => item.slug === info.provider)
            || providers.find((item) => item.is_current)
            || null;
          const models = provider && Array.isArray(provider.models) ? provider.models : [];
          setModelInfo({
            provider: String((info && info.provider) || (provider && provider.slug) || ""),
            model: String((info && info.model) || (options && options.model) || ""),
          });
          setModelOptions(Array.from(new Set(models.map(String).filter(Boolean))));
        })
        .catch(() => {})
        .finally(() => { if (active) setModelsLoading(false); });
      return () => { active = false; };
    }, []);

    useEffect(function () {
      let active = true;
      api.getDefaultCwd()
        .then((info) => api.listFiles(info && info.cwd).then(() => info.cwd))
        .catch(() => api.listFiles().then((listing) => listing.path))
        .then((cwd) => {
          if (active && cwd) setParentPath(defaultProjectsRoot(cwd));
        })
        .catch(() => {});
      return () => { active = false; };
    }, []);

    const updateSkillModel = function (id, model) {
      setSkillModels((current) => {
        const next = { ...current };
        if (model) next[id] = model;
        else delete next[id];
        writeStored(SKILL_MODELS_KEY, next);
        return next;
      });
    };

    const defaultModelLabel = [modelInfo.provider, modelInfo.model].filter(Boolean).join(" · ")
      || (modelsLoading ? "Loading current model…" : "Configured session model");
    const unavailableSelectedModels = modelOptions.length
      ? SKILLS
          .filter((skill) => selected.has(skill[0]))
          .map((skill) => ({ id: skill[0], label: skill[1], model: skillModels[skill[0]] }))
          .filter((item) => typeof item.model === "string" && item.model && !modelOptions.includes(item.model))
      : [];

    const applyTemplate = function (template) {
      setTemplateId(template.id);
      setSelected(withRequired(template.skills));
      if (template.models && typeof template.models === "object") {
        setSkillModels(template.models);
        writeStored(SKILL_MODELS_KEY, template.models);
      }
    };

    const begin = function (nextMode, template) {
      setMode(nextMode);
      applyTemplate(template || BUILTIN_TEMPLATES[0]);
      setBrief("");
      setError("");
      setScreen("configure");
    };

    const toggleSkill = function (id) {
      if (REQUIRED_SKILL_IDS.indexOf(id) !== -1) return;
      setSelected((current) => {
        const next = new Set(current);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    };

    const saveTemplate = function () {
      const name = templateName.trim();
      if (!name) return;
      const value = {
        id: "custom-" + Date.now().toString(36),
        name,
        description: selected.size + " selected agents",
        skills: Array.from(selected),
        models: Object.fromEntries(
          Array.from(selected)
            .filter((id) => typeof skillModels[id] === "string" && skillModels[id].trim())
            .map((id) => [id, skillModels[id].trim()]),
        ),
      };
      const next = customTemplates.concat(value);
      setCustomTemplates(next);
      writeStored(CUSTOM_TEMPLATES_KEY, next);
      setTemplateName("");
      applyTemplate(value);
    };

    const deleteTemplate = function (id) {
      const next = customTemplates.filter((template) => template.id !== id);
      setCustomTemplates(next);
      writeStored(CUSTOM_TEMPLATES_KEY, next);
      if (templateId === id) applyTemplate(BUILTIN_TEMPLATES[0]);
    };

    const openRecent = async function (item) {
      try {
        const workspace = await requireSafeWorkspace(item.path);
        const params = new URLSearchParams({
          guided: "1",
          workspace,
        });
        window.location.href = "/chat?" + params.toString();
      } catch (err) {
        setMode("existing");
        setProjectPath(item.path);
        setError(err && err.message ? err.message : String(err));
        setScreen("configure");
      }
    };

    const startChat = async function () {
      setStarting(true);
      setError("");
      try {
        if (unavailableSelectedModels.length) {
          throw new Error(
            "Choose replacement models for "
              + unavailableSelectedModels.map((item) => item.label).join(", ")
              + " before starting. Lyra will not guess an equivalent.",
          );
        }
        let workspace = projectPath.trim();
        if (mode === "new") {
          const name = projectName.trim();
          if (!parentPath.trim() || !name) throw new Error("Choose where to save the project and give it a name.");
          if (!/^[^/\\\\]+$/.test(name) || name === "." || name === "..") {
            throw new Error("Use a simple project name without slashes.");
          }
          workspace = joinPath(parentPath.trim(), name);
          workspace = await requireSafeWorkspace(workspace);
          await api.createDirectory(workspace);
        } else {
          if (!workspace) throw new Error("Choose the existing project folder.");
          workspace = await requireSafeWorkspace(workspace);
          await api.listFiles(workspace);
        }
        const enabled = SKILLS.filter((skill) => selected.has(skill[0])).map((skill) => skill[0]);
        const enabledLabels = SKILLS.filter((skill) => selected.has(skill[0])).map((skill) => skill[1]);
        const disabled = SKILLS.filter((skill) => !selected.has(skill[0])).map((skill) => skill[0]);
        const disabledLabels = SKILLS.filter((skill) => !selected.has(skill[0])).map((skill) => skill[1]);
        const specialistModels = Object.fromEntries(
          enabled
            .filter((id) => typeof skillModels[id] === "string" && skillModels[id].trim())
            .map((id) => [id, skillModels[id].trim()]),
        );
        const codeChangesAllowed = ["sw-developer", "oop-restructurer", "debugger"]
          .some((skill) => selected.has(skill));
        const request = brief.trim() || defaultBrief(templateId, mode === "existing");
        const prompt = "IDRAK_INTERNAL_SETUP_BEGIN " + JSON.stringify({
          instruction: "Lyra is the permanent user-facing coordinator. Start with the internal ultimate-builder:app-it skill, work only in the selected workspace, and keep internal skill names, tools, and orchestration out of user-facing messages. Vocabulary: to the user these are AGENTS — the requirements agent, the design agent, the development agent. Never say skill, specialist, playbook, or subagent in a user-facing message. The enabled_specialists list is the approved initial team, not an immutable restriction. Recommend only the smallest useful team. Emit APP_IT_SKILLS_SET to open the dashboard's editable recommendation; the marker itself never applies a team. Wait for the user's dashboard confirmation and the resulting IDRAK_INTERNAL_SKILLS_UPDATE before using added agents. Manual dashboard changes are authoritative. Load every agent with skill_view(name='ultimate-builder:<specialist-id>') immediately before running it, and never claim an agent ran unless its playbook was actually loaded. Requirements is mandatory but not always active: use skill_view(name='ultimate-builder:req-engineer') for the first meaningful brief without approved requirements, an active requirements interview, an explicit requirements revision, or a material change to scope, user-visible behavior, data, permissions, integrations, or acceptance criteria. Do not invoke it for greetings, status, explanations, approvals, pause/stop commands, ordinary in-scope feedback, or minor fixes. When needed, run its Grill, design-space exploration and approval gate in this conversation and produce an approved requirements.md before affected downstream work.",
          first_turn_gate: mode === "new"
            ? "Speak as Lyra. Begin with a warm one-sentence greeting, explain that you will help shape the project and choose the right agents, then ask exactly ONE short product question. Hand the detailed interview to the requirements agent rather than running it yourself. Then recommend the smallest useful agent team and ask permission before adding it. Do not write code before the team and requirements are approved."
            : "Speak as Lyra. Inspect the existing workspace read-only, then begin with a warm one-sentence greeting, briefly say what the project appears to be, and ask exactly ONE question about the outcome the user wants. Recommend the smallest useful specialist team and ask permission before adding it.",
          coordination_rule: "Remain the user's single point of contact. Coordinate only the currently enabled specialist phases and verify each phase's evidence. Specialist delegates return before you continue. Stop for user approval at requirements, visual preview for UI projects, team changes, and final delivery. Present checkpoints with Approve / Change / Skip options. Never ask the user to wake or resume an internal workflow.",
          skill_change_rule: "When proposing the smallest useful team, emit exactly one [APP_IT_SKILLS_SET:comma-separated-ids] marker. The dashboard will hide it and show editable checkboxes; the marker is a proposal, not approval. Do not use newly proposed agents until an IDRAK_INTERNAL_SKILLS_UPDATE arrives after the user confirms the selection. Treat that selection and specialist_models map as authoritative and acknowledge it briefly without emitting another marker.",
          model_routing_rule: "For every delegate_task specialist phase, look up its specialist id in specialist_models. When a model is assigned, pass that exact value in delegate_task.model (or the task item's model field for a batch). Never substitute another model. When no model is assigned, omit the model field so the configured delegation/session default is inherited. These assignments apply to specialist delegates only; the coordinating conversation keeps its session model.",
          delivery_rule: templateId === "mvp"
            ? "This is the MVP fast path. Keep artifacts and research proportional to the requested app. After requirements approval: if the project has a UI, you MUST generate a quick visual preview (1-3 static HTML/CSS mockups in .sdlc/preview/) and STOP to show the user and get their explicit approval before writing any application code. Present: 'Preview ready — open .sdlc/preview/index.html. Does this look like what you want? Approve / Change / Skip.' Then move to development, smoke QA, and concise run documentation; do not invent architecture or task-planning phases when they are disabled."
            : "Use the selected specialist phases at appropriate depth for the project.",
          workspace,
          template: activeTemplate.name,
          enabled_specialists: enabled,
          enabled_specialist_labels: enabledLabels,
          disabled_specialists: disabled,
          disabled_specialist_labels: disabledLabels,
          specialist_models: specialistModels,
          default_specialist_model: modelInfo.model,
          default_specialist_provider: modelInfo.provider,
          code_changes_allowed: codeChangesAllowed,
          user_request: request,
        }) + " IDRAK_INTERNAL_SETUP_END";

        const recent = [{ path: workspace, templateId, name: projectName.trim() || workspace.split(/[\\\\/]/).filter(Boolean).pop() || "Project" }]
          .concat(recentProjects.filter((item) => item.path !== workspace))
          .slice(0, 8);
        setRecentProjects(recent);
        writeStored(RECENT_PROJECTS_KEY, recent);

        const params = new URLSearchParams({
          guided: "1",
          workspace,
          builder: prompt,
        });
        window.location.href = "/chat?" + params.toString();
      } catch (err) {
        setError(err && err.message ? err.message : String(err));
        setStarting(false);
      }
    };

    if (pickerTarget) {
      return h("div", { className: "ub-page ub-page-picker" },
        h(DirectoryPicker, {
          initialPath: pickerTarget === "parent" ? parentPath : projectPath,
          onCancel: () => setPickerTarget(""),
          onSelect: (value) => {
            if (pickerTarget === "parent") setParentPath(value);
            else setProjectPath(value);
            setPickerTarget("");
          },
        }),
      );
    }

    if (screen === "home") {
      return h("div", { className: "ub-page" },
        h("section", { className: "ub-welcome" },
          h("p", { className: "ub-kicker" }, "LYRA · APP BUILDER · v 0.19.1 beta"),
          h("h1", null, "What would you like to work on?"),
          h("p", { className: "ub-subtitle" }, "Start something new or bring an existing folder. Lyra learns what you need, recommends the right agents, and stays with you through delivery."),
          h("button", {
            className: "ub-model-settings",
            type: "button",
            onClick: () => { window.location.href = "/models"; },
          }, "⚙ AI model settings"),
        ),
        h("section", { className: "ub-start-grid", "aria-label": "Choose project action" },
          h("button", { className: "ub-start-card ub-start-new", type: "button", onClick: () => begin("new", BUILTIN_TEMPLATES[0]) },
            h("span", { className: "ub-start-symbol" }, "+"),
            h("strong", null, "New project"),
            h("span", null, "Create a folder, then tell Lyra what you want to build."),
          ),
          h("button", { className: "ub-start-card", type: "button", onClick: () => begin("existing", BUILTIN_TEMPLATES[0]) },
            h("span", { className: "ub-start-symbol" }, "⌑"),
            h("strong", null, "Open a project"),
            h("span", null, "Choose a folder. Lyra inspects it and suggests who should help."),
          ),
        ),
        h("section", { className: "ub-template-preview" },
          h("div", { className: "ub-section-heading" },
            h("div", null, h("h2", null, "Ready-made workflows"), h("p", null, "Every skill can be switched on or off before you start.")),
          ),
          h("div", { className: "ub-template-grid" },
            BUILTIN_TEMPLATES.map((template) => h("button", {
              className: "ub-template-card ub-accent-" + template.accent,
              key: template.id,
              type: "button",
              onClick: () => begin(template.id === "review" ? "existing" : "new", template),
            },
              h("div", { className: "ub-template-top" }, h("strong", null, template.name), h(Badge, null, template.skills.length + " agents")),
              h("p", null, template.description),
            )),
          ),
        ),
        recentProjects.length > 0 && h("section", { className: "ub-recents" },
          h("div", { className: "ub-section-heading" }, h("div", null, h("h2", null, "Recent projects"), h("p", null, "Continue with a previous folder."))),
          h("div", { className: "ub-recent-list" },
            recentProjects.map((item) => h("button", { key: item.path, type: "button", onClick: () => openRecent(item) },
              h("strong", null, item.name), h("span", null, item.path),
            )),
          ),
        ),
      );
    }

    return h("div", { className: "ub-page" },
      h("div", { className: "ub-config-head" },
        h(Button, { ghost: true, onClick: () => setScreen("home") }, "← Back"),
        h("div", null,
          h("p", { className: "ub-kicker" }, mode === "new" ? "NEW PROJECT" : "EXISTING PROJECT"),
          h("h1", null, "Start with Lyra"),
          h("p", null, "Describe what you want. Add a starting team now, or let Lyra recommend one after a few questions."),
        ),
      ),
      h("div", { className: "ub-config-layout" },
        h("div", { className: "ub-config-main" },
          h(Card, { className: "ub-form-card" },
            h(CardContent, null,
              h("h2", null, mode === "new" ? "Project folder" : "Open project"),
              mode === "new"
                ? h("div", { className: "ub-new-project-fields" },
                    h("label", null, h("span", null, "Save inside"),
                      h("div", { className: "ub-inline-field" },
                        h(Input, { value: parentPath, readOnly: true, placeholder: "Choose a folder…" }),
                        h(Button, { outlined: true, onClick: () => setPickerTarget("parent") }, "Browse"),
                      ),
                    ),
                    h("label", null, h("span", null, "Project name"),
                      h(Input, { value: projectName, onChange: (event) => setProjectName(event.target.value), placeholder: "My new app" }),
                    ),
                  )
                : h("label", null, h("span", null, "Project folder"),
                    h("div", { className: "ub-inline-field" },
                      h(Input, { value: projectPath, readOnly: true, placeholder: "Choose an existing folder…" }),
                      h(Button, { outlined: true, onClick: () => setPickerTarget("project") }, "Browse"),
                    ),
                  ),
            ),
          ),
          h(Card, { className: "ub-form-card" },
            h(CardContent, null,
              h("div", { className: "ub-section-heading" },
                h("div", null, h("h2", null, "Starting team (optional)"), h("p", null, selected.size + " of " + SKILLS.length + " agents selected · Lyra is always available; Requirements activates when needed")),
                h("div", { className: "ub-select-actions" },
                  h("button", { type: "button", onClick: () => setSelected(withRequired(activeTemplate.skills)) }, "Reset to workflow"),
                  h("button", { type: "button", onClick: () => setSelected(withRequired([])) }, "Clear optional"),
                ),
              ),
              h("div", { className: "ub-skill-list" },
                SKILLS.map((skill) => {
                  const assignedModel = typeof skillModels[skill[0]] === "string" ? skillModels[skill[0]] : "";
                  const choices = assignedModel && !modelOptions.includes(assignedModel)
                    ? [assignedModel].concat(modelOptions)
                    : modelOptions;
                  const required = REQUIRED_SKILL_IDS.indexOf(skill[0]) !== -1;
                  const on = required || selected.has(skill[0]);
                  return h("label", { className: "ub-skill", key: skill[0] },
                    h("input", { type: "checkbox", checked: on, disabled: required, onChange: () => toggleSkill(skill[0]) }),
                    h("span", { className: "ub-skill-check" }, on ? "✓" : ""),
                    h("img", {
                      className: "ub-skill-avatar",
                      src: "/skill-avatars/" + skill[0].replace("_", "-") + (on ? "" : "-sad") + ".webp",
                      alt: on ? skill[1] + " mascot, happy and ready" : skill[1] + " mascot, sad and waiting",
                      // A newly added agent may not have artwork yet; an initial
                      // beats a broken-image glyph.
                      onError: (event) => {
                        const img = event.currentTarget;
                        if (img.dataset.fallback) return;
                        img.dataset.fallback = "1";
                        const tile = document.createElement("span");
                        tile.className = "ub-skill-avatar ub-skill-avatar-fallback";
                        tile.textContent = skill[1].slice(0, 1).toUpperCase();
                        img.replaceWith(tile);
                      },
                    }),
                    h("span", { className: "ub-skill-copy" },
                      h("strong", null, skill[1], required ? h("em", { className: "ub-skill-required" }, "always available") : null),
                      h("small", null, skill[2])),
                    on && h("span", {
                      className: "ub-skill-model",
                      onClick: (event) => event.stopPropagation(),
                      onMouseDown: (event) => event.stopPropagation(),
                    },
                      h("span", { className: "ub-skill-model-label" }, "LLM"),
                      h("select", {
                        value: assignedModel,
                        onChange: (event) => updateSkillModel(skill[0], event.target.value),
                        "aria-label": "LLM for " + skill[1],
                      },
                        h("option", { value: "" }, "Follow project model · " + defaultModelLabel),
                        choices.map((model) => h("option", { value: model, key: model },
                          model === assignedModel && on && !modelOptions.includes(model)
                            ? "Unavailable on " + (modelInfo.provider || "current provider") + " · " + model
                            : model,
                        )),
                      ),
                    ),
                  );
                }),
              ),
              unavailableSelectedModels.length > 0 && h("div", { className: "ub-error", role: "alert" },
                "Provider changed. Choose a replacement model or Follow project model for: "
                  + unavailableSelectedModels.map((item) => item.label).join(", "),
              ),
              h("div", { className: "ub-save-template" },
                h(Input, { value: templateName, onChange: (event) => setTemplateName(event.target.value), placeholder: "Name this skill set…" }),
                h(Button, { outlined: true, disabled: !templateName.trim(), onClick: saveTemplate }, "Save template"),
              ),
            ),
          ),
          h(Card, { className: "ub-form-card" },
            h(CardContent, null,
              h("h2", null, "What should Lyra help with?"),
              h("textarea", {
                value: brief,
                onChange: (event) => setBrief(event.target.value),
                placeholder: defaultBrief(templateId, mode === "existing"),
                rows: 5,
                className: "ub-brief",
              }),
            ),
          ),
        ),
        h("aside", { className: "ub-config-side" },
          h("h2", null, "Workflow template"),
          h("div", { className: "ub-template-stack" },
            templates.map((template) => h("div", {
              className: "ub-template-option " + (template.id === templateId ? "is-selected" : ""),
              key: template.id,
            },
              h("button", { type: "button", onClick: () => applyTemplate(template) },
                h("span", { className: "ub-radio" }, template.id === templateId ? "●" : "○"),
                h("span", null, h("strong", null, template.name), h("small", null, template.description)),
              ),
              template.id.startsWith("custom-") && h("button", {
                className: "ub-delete-template",
                type: "button",
                onClick: () => deleteTemplate(template.id),
                "aria-label": "Delete " + template.name,
              }, "×"),
            )),
          ),
          h("div", { className: "ub-summary" },
            h("span", null, "Starting team"), h("strong", null, selected.size ? selected.size + " specialists" : "Lyra only"),
            h("p", null,
              selected.size
                ? "Lyra can recommend changes later and will ask before applying them."
                : "Lyra will ask a few questions and recommend the smallest useful team.",
            ),
          ),
          error && h("div", { className: "ub-error", role: "alert" }, error),
          h(Button, { className: "ub-start-chat", onClick: startChat, disabled: starting || unavailableSelectedModels.length > 0 },
            starting ? "Starting project…" : "Start Project →",
          ),
          h("p", { className: "ub-chat-note" }, "The project opens in a simple chat. Lyra handles tools and terminal work quietly in the background."),
        ),
      ),
    );
  }

  window.__IDRAK_IT_PLUGINS__.register("ultimate-builder", App);
})();
