(function () {
  "use strict";

  const SDK = window.__IDRAK_IT_PLUGIN_SDK__;
  if (!SDK || !window.__IDRAK_IT_PLUGINS__) return;

  const { React, api } = SDK;
  const h = React.createElement;
  const { useCallback, useEffect, useMemo, useState } = SDK.hooks;
  const { Button, Card, CardContent, Input, Badge } = SDK.components;

  const SKILLS = [
    ["req-engineer", "Requirements", "Clarify goals, users, scope, and acceptance criteria.", "ʕ•ᴥ•ʔ", "ʕ·ᴥ·ʔ"],
    ["spec", "Technical specification", "Turn the request into detailed, testable behavior.", "(•̀ᴗ•́)و", "(•́︿•̀)"],
    ["sw-architect", "Architecture", "Design the system, data, APIs, and boundaries.", "⌐■‿■", "⌐■︿■"],
    ["task-planner", "Task planning", "Create an ordered implementation graph.", "ᕕ( ᐛ )ᕗ", "ᕙ(⇀‸↼)ᕗ"],
    ["proj-manager", "Project planning", "Build milestones, checkpoints, and delivery plans.", "(•‿•)✎", "(╥﹏╥)✎"],
    ["sw-developer", "Development", "Write and integrate working application code.", "(⌨•̀ᴗ•́)", "(⌨•́︿•̀)"],
    ["oop-restructurer", "Code restructuring", "Improve modules, classes, and maintainability.", "└(＾＾)┐", "└(︶︿︶)┐"],
    ["debugger", "Debugging", "Find root causes and add regression coverage.", "ᕦ(ò_óˇ)ᕤ", "(×_×)"],
    ["code-reviewer", "Code review", "Review correctness, quality, and maintainability.", "(¬‿¬)✓", "(¬_¬)"],
    ["qa-engineer", "Quality assurance", "Test real user journeys and report reproducible bugs.", "(•̀ᴗ•́)و✓", "(ಥ﹏ಥ)"],
    ["security-auditor", "Security", "Audit authentication, data, dependencies, and secrets.", "ᕙ(⇀‸↼)ᕗ", "(⊙﹏⊙)"],
    ["devops-engineer", "Deployment", "Prepare CI/CD, containers, operations, and rollback.", "ヽ(•‿•)ノ", "ヽ(ಠ_ಠ)ノ"],
    ["tech-writer", "Documentation", "Write user, developer, and API documentation.", "φ(•ᴗ•)", "φ(._.)"],
    ["benchmark", "Benchmarks", "Measure speed, reliability, and resource usage.", "(ง •̀_•́)ง", "(ง′︿‵)ง"],
    ["health", "Health checks", "Record operational health and stability baselines.", "♥(ˆ⌣ˆ)", "♡(︶︹︺)"],
    ["context-save", "Context preservation", "Keep decisions and progress available between sessions.", "(づ｡◕‿‿◕｡)づ", "(づಥ﹏ಥ)づ"],
    ["learn", "Controlled learning", "Record evidence-backed improvement candidates.", "٩(◕‿◕)۶", "٩(×̯×)۶"],
    ["idk_it", "Workflow coordination", "Act as team lead: sequence the selected specialists and verify their evidence.", "(☞ﾟヮﾟ)☞", "☜(ಥ﹏ಥ)"],
  ];

  const ALL_SKILL_IDS = SKILLS.map((skill) => skill[0]);
  const BUILTIN_TEMPLATES = [
    {
      id: "sdlc",
      name: "Full SDLC",
      description: "Complete product delivery from requirements through security, deployment, and learning.",
      skills: ALL_SKILL_IDS,
      accent: "lime",
    },
    {
      id: "mvp",
      name: "MVP",
      description: "A focused path to a useful, tested first release.",
      skills: ["req-engineer", "sw-architect", "task-planner", "sw-developer", "qa-engineer", "tech-writer", "idk_it"],
      accent: "coral",
    },
    {
      id: "planning",
      name: "Plan only",
      description: "Requirements, specification, architecture, and project planning—no coding.",
      skills: ["req-engineer", "spec", "sw-architect", "task-planner", "proj-manager", "context-save", "idk_it"],
      accent: "blue",
    },
    {
      id: "review",
      name: "Review & QA",
      description: "Open an existing folder for independent review, testing, debugging, and security.",
      skills: ["code-reviewer", "qa-engineer", "debugger", "security-auditor", "tech-writer", "idk_it"],
      accent: "violet",
    },
  ];

  const CUSTOM_TEMPLATES_KEY = "idrak-it.builder.templates.v1";
  const RECENT_PROJECTS_KEY = "idrak-it.builder.projects.v1";

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

  function joinPath(parent, name) {
    const separator = parent && parent.includes("\\") && !parent.includes("/") ? "\\" : "/";
    return String(parent || "").replace(/[\\/]+$/, "") + separator + name;
  }

  function defaultBrief(templateId, existing) {
    if (templateId === "planning") return "Understand this project and create a clear requirements, architecture, and project plan. Do not implement code.";
    if (templateId === "review") return "Review this existing project, run appropriate QA checks, identify important defects, and recommend verified fixes.";
    if (existing) return "Improve this existing project using the selected specialists. Inspect it first, preserve unrelated work, and confirm the plan before broad changes.";
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
    const [templateId, setTemplateId] = useState("mvp");
    const [selected, setSelected] = useState(new Set(BUILTIN_TEMPLATES[1].skills));
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

    const templates = useMemo(
      () => BUILTIN_TEMPLATES.concat(customTemplates.map((template) => ({ ...template, accent: "custom" }))),
      [customTemplates],
    );
    const activeTemplate = templates.find((template) => template.id === templateId) || templates[0];

    const applyTemplate = function (template) {
      setTemplateId(template.id);
      setSelected(new Set(template.skills));
    };

    const begin = function (nextMode, template) {
      setMode(nextMode);
      applyTemplate(template || BUILTIN_TEMPLATES[nextMode === "new" ? 1 : 3]);
      setBrief("");
      setError("");
      setScreen("configure");
    };

    const toggleSkill = function (id) {
      setSelected((current) => {
        const next = new Set(current);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    };

    const saveTemplate = function () {
      const name = templateName.trim();
      if (!name || !selected.size) return;
      const value = {
        id: "custom-" + Date.now().toString(36),
        name,
        description: selected.size + " selected skills",
        skills: Array.from(selected),
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
      if (templateId === id) applyTemplate(BUILTIN_TEMPLATES[1]);
    };

    const openRecent = function (item) {
      setMode("existing");
      setProjectPath(item.path);
      const template = templates.find((candidate) => candidate.id === item.templateId) || BUILTIN_TEMPLATES[3];
      applyTemplate(template);
      setBrief("");
      setScreen("configure");
    };

    const startChat = async function () {
      setStarting(true);
      setError("");
      try {
        let workspace = projectPath.trim();
        if (mode === "new") {
          const name = projectName.trim();
          if (!parentPath.trim() || !name) throw new Error("Choose where to save the project and give it a name.");
          if (!/^[^/\\\\]+$/.test(name) || name === "." || name === "..") {
            throw new Error("Use a simple project name without slashes.");
          }
          workspace = joinPath(parentPath.trim(), name);
          await api.createDirectory(workspace);
        } else {
          if (!workspace) throw new Error("Choose the existing project folder.");
          await api.listFiles(workspace);
        }
        if (!selected.size) throw new Error("Select at least one skill.");

        const enabled = SKILLS.filter((skill) => selected.has(skill[0])).map((skill) => skill[1]);
        const disabled = SKILLS.filter((skill) => !selected.has(skill[0])).map((skill) => skill[1]);
        const codeChangesAllowed = ["sw-developer", "oop-restructurer", "debugger"]
          .some((skill) => selected.has(skill));
        const request = brief.trim() || defaultBrief(templateId, mode === "existing");
        const prompt = "IDRAK_INTERNAL_SETUP_BEGIN " + JSON.stringify({
          instruction: "Use ultimate-builder:ultimate-app-builder. Work only in the selected workspace, run only enabled specialist phases, and ask only concise questions when an important decision is missing.",
          workspace,
          template: activeTemplate.name,
          enabled_specialists: enabled,
          disabled_specialists: disabled,
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
          h("p", { className: "ub-kicker" }, "IDRAK IT · APP BUILDER"),
          h("h1", null, "What would you like to work on?"),
          h("p", { className: "ub-subtitle" }, "Start something new or bring an existing folder. You choose the experts; Idrak IT keeps everything in one simple conversation."),
          h("button", {
            className: "ub-model-settings",
            type: "button",
            onClick: () => { window.location.href = "/models"; },
          }, "⚙ AI model settings"),
        ),
        h("section", { className: "ub-start-grid", "aria-label": "Choose project action" },
          h("button", { className: "ub-start-card ub-start-new", type: "button", onClick: () => begin("new", BUILTIN_TEMPLATES[1]) },
            h("span", { className: "ub-start-symbol" }, "+"),
            h("strong", null, "New project"),
            h("span", null, "Create a folder, choose a workflow, and start chatting."),
          ),
          h("button", { className: "ub-start-card", type: "button", onClick: () => begin("existing", BUILTIN_TEMPLATES[3]) },
            h("span", { className: "ub-start-symbol" }, "⌑"),
            h("strong", null, "Open a project"),
            h("span", null, "Select an existing folder for planning, review, QA, or development."),
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
              h("div", { className: "ub-template-top" }, h("strong", null, template.name), h(Badge, null, template.skills.length + " skills")),
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
          h("h1", null, "Set up your conversation"),
          h("p", null, "Choose a workflow, adjust its skills, then describe what you need."),
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
                h("div", null, h("h2", null, "Skills"), h("p", null, selected.size + " of " + SKILLS.length + " selected")),
                h("div", { className: "ub-select-actions" },
                  h("button", { type: "button", onClick: () => setSelected(new Set(ALL_SKILL_IDS)) }, "Select all"),
                  h("button", { type: "button", onClick: () => setSelected(new Set()) }, "Clear"),
                ),
              ),
              h("div", { className: "ub-skill-list" },
                SKILLS.map((skill) => h("label", { className: "ub-skill", key: skill[0] },
                  h("input", { type: "checkbox", checked: selected.has(skill[0]), onChange: () => toggleSkill(skill[0]) }),
                  h("span", { className: "ub-skill-check" }, selected.has(skill[0]) ? "✓" : ""),
                  h("span", {
                    className: "ub-skill-avatar",
                    "aria-hidden": "true",
                    title: selected.has(skill[0]) ? "Happy and ready" : "Sad and waiting",
                  }, selected.has(skill[0]) ? skill[3] : skill[4]),
                  h("span", { className: "ub-skill-copy" }, h("strong", null, skill[1]), h("small", null, skill[2])),
                )),
              ),
              h("div", { className: "ub-save-template" },
                h(Input, { value: templateName, onChange: (event) => setTemplateName(event.target.value), placeholder: "Name this skill set…" }),
                h(Button, { outlined: true, disabled: !templateName.trim() || !selected.size, onClick: saveTemplate }, "Save template"),
              ),
            ),
          ),
          h(Card, { className: "ub-form-card" },
            h(CardContent, null,
              h("h2", null, "What should Idrak IT help with?"),
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
            h("span", null, "Selected"), h("strong", null, selected.size + " skills"),
            h("p", null,
              ["sw-developer", "oop-restructurer", "debugger"].some((skill) => selected.has(skill))
                ? "You can change the selection at any time before starting."
                : "Planning/advisory only—code changes are disabled.",
            ),
          ),
          error && h("div", { className: "ub-error", role: "alert" }, error),
          h(Button, { className: "ub-start-chat", onClick: startChat, disabled: starting || !selected.size },
            starting ? "Opening conversation…" : "Start conversation →",
          ),
          h("p", { className: "ub-chat-note" }, "The project opens in a simple chat. Idrak IT handles tools and terminal work quietly in the background."),
        ),
      ),
    );
  }

  window.__IDRAK_IT_PLUGINS__.register("ultimate-builder", App);
})();
