"""Small, keyless integration with the Ollama app running on this computer."""

from __future__ import annotations

import json
import shutil
import urllib.request
from typing import Any, Dict


LOCAL_OLLAMA_ROOT = "http://127.0.0.1:11434"
LOCAL_OLLAMA_OPENAI_URL = f"{LOCAL_OLLAMA_ROOT}/v1"


def local_ollama_status(timeout: float = 2.0) -> Dict[str, Any]:
    """Detect local Ollama and list its models without reading an API key."""
    executable = shutil.which("ollama")
    try:
        request = urllib.request.Request(
            f"{LOCAL_OLLAMA_ROOT}/api/tags",
            headers={"Accept": "application/json"},
        )
        with urllib.request.urlopen(request, timeout=timeout) as response:
            payload = json.loads(response.read().decode("utf-8"))
        models = []
        for item in payload.get("models", []):
            if not isinstance(item, dict):
                continue
            name = str(item.get("name") or item.get("model") or "").strip()
            if name and name not in models:
                models.append(name)
        return {
            "installed": bool(executable),
            "executable": executable or "",
            "running": True,
            "endpoint": LOCAL_OLLAMA_ROOT,
            "models": models,
            "auth": "none",
            "message": (
                f"Ready — {len(models)} model{'s' if len(models) != 1 else ''} found. "
                "Local requests do not need an API key."
            ),
        }
    except Exception as exc:
        return {
            "installed": bool(executable),
            "executable": executable or "",
            "running": False,
            "endpoint": LOCAL_OLLAMA_ROOT,
            "models": [],
            "auth": "none",
            "message": (
                "Ollama is installed but its local server is not responding."
                if executable
                else "Ollama is not installed on this computer."
            ),
            "error": str(exc),
        }


def local_ollama_provider(models: list[str]) -> Dict[str, Any]:
    """Return the saved-provider configuration for local Ollama."""
    return {
        "name": "Ollama — this computer",
        "api": LOCAL_OLLAMA_OPENAI_URL,
        "transport": "chat_completions",
        "models": models,
        "discover_models": True,
    }
