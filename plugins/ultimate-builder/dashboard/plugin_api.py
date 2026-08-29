"""Dashboard API for Ultimate Builder project state and local app previews."""

from __future__ import annotations

import importlib.util
import json
import re
import secrets
from functools import lru_cache
from html import escape
from pathlib import Path
from typing import Any
from urllib.parse import urljoin, urlparse

import httpx
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field


router = APIRouter()
_LYRA_CHECKOUT = Path(__file__).resolve().parents[3]
_ALLOWED_CHECKOUT_WORKSPACES = (
    _LYRA_CHECKOUT / "my_projects",
    _LYRA_CHECKOUT / "song-maker-studio",
)
_ARTIFACTS = (
    "requirements.md",
    "mvp-brief.md",
    "plan.md",
    "task-graph.md",
    "project-plan.md",
    "review-report.md",
    "bug-report.md",
    "security-report.md",
    "benchmark-report.md",
    "DEPLOYMENT.md",
    "README.md",
    ".sdlc/debt.md",
    ".sdlc/preview/index.html",
)
_PREVIEW_MAX_BYTES = 4 * 1024 * 1024
_PREVIEW_REDIRECT_LIMIT = 4
_LOOPBACK_HOSTS = frozenset({"localhost", "127.0.0.1", "::1"})
_HTML_URL_ATTRIBUTE = re.compile(
    r"(?P<prefix>\b(?:src|href|action|poster)\s*=\s*[\"'])(?P<path>/[^/][^\"']*)",
    re.IGNORECASE,
)
_BASE_TAG = re.compile(r"<base\b[^>]*>", re.IGNORECASE)
_CSP_META = re.compile(
    r"<meta\b(?=[^>]*http-equiv\s*=\s*[\"']?content-security-policy[\"']?)[^>]*>",
    re.IGNORECASE,
)

_PHASE_IDS = (
    (re.compile(r"\brequirements?\b", re.I), "req-engineer"),
    (re.compile(r"\bresearch\b", re.I), "researcher"),
    (re.compile(r"\b(?:ui|ux|visual)?\s*design\b", re.I), "ui-designer"),
    (re.compile(r"\barchitecture\b", re.I), "sw-architect"),
    (re.compile(r"\b(?:development|implementation)\b", re.I), "sw-developer"),
    (re.compile(r"\bdebug(?:ging)?\b", re.I), "debugger"),
    (re.compile(r"\bux writing\b", re.I), "ux-writer"),
    (re.compile(r"\b(?:quality assurance|qa|verification)\b", re.I), "qa-engineer"),
    (re.compile(r"\bsecurity\b", re.I), "security-auditor"),
    (re.compile(r"\baccessibility\b", re.I), "a11y-auditor"),
    (re.compile(r"\bdocumentation\b", re.I), "tech-writer"),
    (re.compile(r"\bcontext preservation\b", re.I), "context-save"),
    (re.compile(r"\b(?:release|deployment|signing|notarization)\b", re.I), "devops-engineer"),
)


def _phase_id(label: str) -> str:
    for pattern, phase_id in _PHASE_IDS:
        if pattern.search(label):
            return phase_id
    slug = re.sub(r"[^a-z0-9]+", "-", label.lower()).strip("-")
    return f"ledger:{slug or 'phase'}"


def _phase_state(status: str) -> str:
    normalized = status.strip().lower()
    if re.search(r"\b(blocked|failed|error)\b", normalized):
        return "blocked"
    if re.search(r"\b(running|in progress|active|underway)\b", normalized):
        return "now"
    if re.search(r"\b(verified|complete|completed|done|passed|green|approved)\b", normalized):
        return "done"
    return "pending"


def _parse_progress_ledger(markdown: str) -> dict[str, Any]:
    """Turn the durable progress table into a UI-safe project map."""
    lines = markdown.splitlines()
    phases: list[dict[str, str]] = []
    for index in range(len(lines) - 2):
        header = [cell.strip().lower() for cell in lines[index].strip().strip("|").split("|")]
        divider = lines[index + 1].strip()
        if "phase" not in header or "status" not in header:
            continue
        if not re.fullmatch(r"\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?", divider):
            continue
        phase_col = header.index("phase")
        status_col = header.index("status")
        evidence_col = header.index("evidence") if "evidence" in header else -1
        for row in lines[index + 2 :]:
            if not row.lstrip().startswith("|"):
                break
            cells = [cell.strip() for cell in row.strip().strip("|").split("|")]
            if max(phase_col, status_col) >= len(cells):
                continue
            label = re.sub(r"[*_`]", "", cells[phase_col]).strip()
            status = re.sub(r"[*_`]", "", cells[status_col]).strip()
            if not label or not status:
                continue
            phases.append(
                {
                    "id": _phase_id(label),
                    "label": label,
                    "status": status,
                    "state": _phase_state(status),
                    "evidence": cells[evidence_col] if 0 <= evidence_col < len(cells) else "",
                }
            )
        break
    return {
        "available": bool(phases),
        "source": ".sdlc/progress.md",
        "phases": phases,
    }


class PreviewDocumentRequest(BaseModel):
    url: str = Field(min_length=1, max_length=2_048)
    workspace: str = Field(min_length=1, max_length=8_192)


class ProjectRunControlRequest(BaseModel):
    workspace: str = Field(min_length=1, max_length=8_192)
    action: str = Field(pattern=r"^(pause|resume|stop)$")


@lru_cache(maxsize=1)
def _project_runs_module():
    """Load the sibling module without relying on the hyphenated plugin name."""
    path = Path(__file__).resolve().parents[1] / "project_runs.py"
    spec = importlib.util.spec_from_file_location(
        "lyra_ultimate_builder_project_runs", path
    )
    if spec is None or spec.loader is None:
        raise RuntimeError("Could not load durable project jobs")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _merge_project_run_state(
    ledger: dict[str, Any], run_state: dict[str, Any]
) -> dict[str, Any]:
    """Overlay persisted worker truth onto the project's phase ledger."""
    phases = [dict(phase) for phase in ledger.get("phases", [])]
    by_id = {phase["id"]: phase for phase in phases}
    task_by_phase = {
        task["phase"]: task for task in run_state.get("tasks", [])
        if task.get("phase")
    }
    for phase_id, task in task_by_phase.items():
        phase = by_id.get(phase_id)
        if phase is None:
            phase = {
                "id": phase_id,
                "label": task.get("label") or phase_id,
                "status": "Not started",
                "state": "pending",
                "evidence": "",
            }
            phases.append(phase)
            by_id[phase_id] = phase
        status = task.get("status")
        if status == "running":
            phase.update(state="now", status="Working safely in the background")
        elif status in {"ready", "todo", "scheduled"}:
            phase.update(state="pending", status="Queued safely")
        elif status in {"blocked", "triage"}:
            phase.update(state="blocked", status="Needs your attention")
        elif status == "done":
            phase.update(state="done", status="Verified")

    # A ledger can be left saying "running" after an old browser-owned worker
    # vanished. Do not keep presenting that as live work when no saved job owns it.
    for phase in phases:
        if (
            run_state.get("state") != "unavailable"
            and phase.get("state") == "now"
            and phase.get("id") not in task_by_phase
        ):
            phase.update(
                state="blocked",
                status="No active agent — Lyra can safely continue this phase",
            )
    return {
        "available": bool(phases),
        "source": (
            "durable-project-jobs"
            if run_state.get("available")
            else ledger.get("source", ".sdlc/progress.md")
        ),
        "phases": phases,
    }


def _workspace_safety(path: str) -> dict[str, Any]:
    """Keep guided builds out of Lyra's tracked application source.

    User projects may live anywhere outside this checkout. Inside the checkout,
    only the explicitly ignored project directories are valid workspaces.
    ``strict=False`` deliberately supports validating a new project before its
    directory is created.
    """
    candidate = Path(path).expanduser().resolve(strict=False)
    inside_checkout = (
        candidate == _LYRA_CHECKOUT
        or candidate.is_relative_to(_LYRA_CHECKOUT)
    )
    in_project_area = any(
        candidate == root or candidate.is_relative_to(root)
        for root in _ALLOWED_CHECKOUT_WORKSPACES
    )
    protected = inside_checkout and not in_project_area
    reason = ""
    if protected:
        reason = (
            "That folder contains Lyra's own application files and is protected. "
            f"Choose or create a project inside {_LYRA_CHECKOUT / 'my_projects'}, "
            "or choose a folder outside the Lyra installation."
        )
    return {
        "path": str(candidate),
        "allowed": not protected,
        "protected": protected,
        "reason": reason,
        "recommended_root": str(_LYRA_CHECKOUT / "my_projects"),
    }


def _project(path: str) -> Path:
    candidate = Path(path).expanduser().resolve()
    if not candidate.is_dir():
        raise HTTPException(status_code=404, detail="Project directory not found")
    return candidate


def _safe_text(path: Path, limit: int = 120_000) -> str:
    try:
        data = path.read_text(encoding="utf-8")
    except (OSError, UnicodeError):
        return ""
    return data[:limit]


def _loopback_preview_url(value: str) -> str:
    raw = value.strip()
    if "://" not in raw:
        raw = f"http://{raw}"
    parsed = urlparse(raw)
    if (
        parsed.scheme not in {"http", "https"}
        or (parsed.hostname or "").lower() not in _LOOPBACK_HOSTS
        or parsed.username
        or parsed.password
    ):
        raise HTTPException(
            status_code=400,
            detail="App Preview only accepts localhost or loopback HTTP URLs.",
        )
    try:
        _ = parsed.port
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid preview port.") from exc
    return parsed.geturl()


def _preview_bridge_script(bridge_token: str, target_url: str) -> str:
    script = r"""
<script>
(() => {
  const token = __LYRA_TOKEN__;
  const targetUrl = __LYRA_TARGET__;
  let selectMode = true;
  let selected = [];
  const send = (type, payload = {}) => parent.postMessage({
    source: "lyra-app-preview", token, type, ...payload
  }, "*");
  const segment = (element) => {
    const esc = (value) => window.CSS && CSS.escape ? CSS.escape(value) : value.replace(/[^a-zA-Z0-9_-]/g, "\\$&");
    if (element.id) return `#${esc(element.id)}`;
    const testId = element.getAttribute("data-testid");
    if (testId) return `[data-testid="${esc(testId)}"]`;
    let value = element.tagName.toLowerCase();
    if (element.parentElement) {
      const siblings = [...element.parentElement.children].filter((item) => item.tagName === element.tagName);
      if (siblings.length > 1) value += `:nth-of-type(${siblings.indexOf(element) + 1})`;
    }
    return value;
  };
  const selector = (element) => {
    const parts = [];
    let current = element;
    while (current && parts.length < 6) {
      const value = segment(current);
      parts.unshift(value);
      if (value.startsWith("#") || value.startsWith("[data-testid=")) break;
      current = current.parentElement;
    }
    return parts.join(" > ");
  };
  const context = (element) => {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    const text = (element.innerText || element.textContent || "").replace(/\s+/g, " ").trim().slice(0, 280);
    const path = selector(element);
    return {
      id: path, selector: path, tag: element.tagName.toLowerCase(), text,
      role: element.getAttribute("role") || "",
      accessibleName: element.getAttribute("aria-label") || element.getAttribute("title") || text.slice(0, 140),
      html: element.outerHTML.slice(0, 1200),
      rect: { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) },
      styles: {
        display: style.display, position: style.position, color: style.color,
        backgroundColor: style.backgroundColor, fontFamily: style.fontFamily,
        fontSize: style.fontSize, fontWeight: style.fontWeight, lineHeight: style.lineHeight,
        padding: style.padding, margin: style.margin, border: style.border, borderRadius: style.borderRadius
      },
      comment: ""
    };
  };
  const refresh = () => {
    document.querySelectorAll("[data-lyra-preview-selected]").forEach((element) => element.removeAttribute("data-lyra-preview-selected"));
    selected.forEach((path) => {
      try { document.querySelector(path)?.setAttribute("data-lyra-preview-selected", "true"); } catch (_) {}
    });
  };
  const style = document.createElement("style");
  style.textContent = `
    [data-lyra-preview-hover] { outline: 2px dashed #8b5cf6 !important; outline-offset: 2px !important; cursor: crosshair !important; }
    [data-lyra-preview-selected] { outline: 3px solid #7c3aed !important; outline-offset: 2px !important; box-shadow: 0 0 0 5px rgba(124,58,237,.18) !important; }
  `;
  document.head.appendChild(style);
  document.addEventListener("pointerover", (event) => {
    if (selectMode && event.target instanceof Element) event.target.setAttribute("data-lyra-preview-hover", "true");
  }, true);
  document.addEventListener("pointerout", (event) => {
    if (event.target instanceof Element) event.target.removeAttribute("data-lyra-preview-hover");
  }, true);
  document.addEventListener("click", (event) => {
    if (!selectMode || !(event.target instanceof HTMLElement)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    send("element-selected", { element: context(event.target) });
  }, true);
  window.addEventListener("message", (event) => {
    const message = event.data || {};
    if (message.source !== "lyra-app-preview-parent" || message.token !== token) return;
    if (message.type === "mode") selectMode = Boolean(message.selectMode);
    if (message.type === "selected") {
      selected = Array.isArray(message.selectors) ? message.selectors : [];
      refresh();
    }
  });
  const stringify = (values) => values.map((value) => {
    if (typeof value === "string") return value;
    try { return JSON.stringify(value); } catch (_) { return String(value); }
  }).join(" ").slice(0, 1000);
  ["error", "warn"].forEach((level) => {
    const original = console[level].bind(console);
    console[level] = (...values) => {
      send("console", { entry: { level, message: stringify(values), at: new Date().toISOString() } });
      original(...values);
    };
  });
  window.addEventListener("error", (event) => send("console", { entry: { level: "error", message: String(event.message || "Page error"), at: new Date().toISOString() } }));
  window.addEventListener("unhandledrejection", (event) => send("console", { entry: { level: "error", message: `Unhandled promise rejection: ${stringify([event.reason])}`, at: new Date().toISOString() } }));
  window.__LYRA_APP_PREVIEW__ = { targetUrl };
  send("ready");
})();
</script>
"""
    return script.replace("__LYRA_TOKEN__", json.dumps(bridge_token)).replace(
        "__LYRA_TARGET__", json.dumps(target_url)
    )


def _preview_html(document: str, target_url: str, bridge_token: str) -> str:
    """Make a fetched local document work inside an authenticated srcdoc frame."""
    parsed = urlparse(target_url)
    origin = f"{parsed.scheme}://{parsed.netloc}"
    document = _CSP_META.sub("", document)
    document = _BASE_TAG.sub("", document)
    document = _HTML_URL_ATTRIBUTE.sub(
        lambda match: f"{match.group('prefix')}{origin}{match.group('path')}",
        document,
    )
    bridge = _preview_bridge_script(bridge_token, target_url)
    base = f'<base href="{escape(target_url, quote=True)}">'
    injection = base + bridge
    head = re.search(r"<head\b[^>]*>", document, re.IGNORECASE)
    if head:
        offset = head.end()
        return document[:offset] + injection + document[offset:]
    return (
        f"<!doctype html><html><head>{injection}</head><body>{document}</body></html>"
    )


async def _fetch_preview_document(url: str) -> tuple[str, str]:
    current = _loopback_preview_url(url)
    timeout = httpx.Timeout(10.0, connect=4.0)
    async with httpx.AsyncClient(
        timeout=timeout,
        follow_redirects=False,
        trust_env=False,
        headers={"Accept": "text/html,application/xhtml+xml"},
    ) as client:
        for _ in range(_PREVIEW_REDIRECT_LIMIT + 1):
            try:
                response = await client.get(current)
            except httpx.RequestError as exc:
                raise HTTPException(
                    status_code=502,
                    detail=f"Could not reach the local app at {current}: {exc}",
                ) from exc
            if response.is_redirect:
                location = response.headers.get("location")
                if not location:
                    break
                current = _loopback_preview_url(urljoin(current, location))
                continue
            if response.status_code >= 400:
                raise HTTPException(
                    status_code=502,
                    detail=f"Local app returned HTTP {response.status_code}.",
                )
            content_type = response.headers.get("content-type", "").lower()
            if (
                "html" not in content_type
                and not response.text
                .lstrip()
                .lower()
                .startswith(("<!doctype html", "<html"))
            ):
                raise HTTPException(
                    status_code=415,
                    detail="The preview URL did not return an HTML document.",
                )
            if len(response.content) > _PREVIEW_MAX_BYTES:
                raise HTTPException(
                    status_code=413,
                    detail="The preview document is larger than 4 MB.",
                )
            return response.text, str(response.url)
    raise HTTPException(status_code=502, detail="Too many local preview redirects.")


@router.get("/workspace-safety")
def workspace_safety(path: str = Query(..., min_length=1)) -> dict[str, Any]:
    return _workspace_safety(path)


@router.get("/state")
def state(path: str = Query(..., min_length=1)) -> dict[str, Any]:
    project = _project(path)
    sdlc = project / ".sdlc"
    progress = sdlc / "progress.md"
    artifacts = []
    for name in _ARTIFACTS:
        item = project / name
        artifacts.append(
            {
                "name": name,
                "exists": item.is_file(),
                "bytes": item.stat().st_size if item.is_file() else 0,
            }
        )

    candidates = []
    candidate_dir = sdlc / "learning-candidates"
    if candidate_dir.is_dir():
        for item in sorted(candidate_dir.glob("*.json"))[:100]:
            try:
                value = json.loads(_safe_text(item, 64_000))
                if isinstance(value, dict):
                    candidates.append(
                        {
                            "file": item.name,
                            "title": str(value.get("title", item.stem)),
                            "risk": str(value.get("risk", "unknown")),
                            "status": str(value.get("status", "candidate")),
                        }
                    )
            except json.JSONDecodeError:
                candidates.append(
                    {
                        "file": item.name,
                        "title": item.stem,
                        "risk": "unknown",
                        "status": "invalid",
                    }
                )

    progress_text = _safe_text(progress)
    ledger = _parse_progress_ledger(progress_text)
    try:
        run_state = _project_runs_module().project_run_state(project)
    except Exception:
        run_state = {
            "available": False,
            "state": "unavailable",
            "active": False,
            "task_count": 0,
            "active_task_count": 0,
            "last_activity_at": None,
            "tasks": [],
        }
    return {
        "project": str(project),
        "has_sdlc": sdlc.is_dir(),
        "progress": progress_text,
        "phase_state": _merge_project_run_state(ledger, run_state),
        "run_state": run_state,
        "artifacts": artifacts,
        "learning_candidates": candidates,
    }


@router.post("/run/control")
def control_project_run(payload: ProjectRunControlRequest) -> dict[str, Any]:
    safety = _workspace_safety(payload.workspace)
    if not safety["allowed"]:
        raise HTTPException(status_code=403, detail=safety["reason"])
    project = _project(payload.workspace)
    try:
        return _project_runs_module().control_project_run(project, payload.action)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/preview/document")
async def preview_document(payload: PreviewDocumentRequest) -> dict[str, str]:
    safety = _workspace_safety(payload.workspace)
    if not safety["allowed"]:
        raise HTTPException(status_code=403, detail=safety["reason"])
    _project(payload.workspace)
    requested_url = _loopback_preview_url(payload.url)
    document, resolved_url = await _fetch_preview_document(requested_url)
    bridge_token = secrets.token_urlsafe(24)
    return {
        "html": _preview_html(document, resolved_url, bridge_token),
        "url": resolved_url,
        "bridge_token": bridge_token,
    }
