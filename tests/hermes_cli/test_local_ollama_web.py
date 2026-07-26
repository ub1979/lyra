import asyncio
from contextlib import contextmanager
import json

from hermes_cli import web_server


class _FakeResponse:
    def __init__(self, payload):
        self._payload = payload

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def read(self):
        return json.dumps(self._payload).encode("utf-8")


def test_local_ollama_status_needs_no_api_key(monkeypatch):
    monkeypatch.setattr(web_server.shutil, "which", lambda name: f"/bin/{name}")
    monkeypatch.setattr(
        web_server.urllib.request,
        "urlopen",
        lambda request, timeout: _FakeResponse(
            {"models": [{"name": "qwen3:8b"}, {"model": "gemma:cloud"}]}
        ),
    )

    result = web_server._local_ollama_status()

    assert result["running"] is True
    assert result["auth"] == "none"
    assert result["models"] == ["qwen3:8b", "gemma:cloud"]


def test_activate_local_ollama_saves_keyless_local_provider(monkeypatch):
    saved = {}

    @contextmanager
    def profile_scope(_profile):
        yield None

    monkeypatch.setattr(
        web_server,
        "_local_ollama_status",
        lambda: {
            "running": True,
            "models": ["qwen3:8b", "gemma:cloud"],
            "message": "Ready",
        },
    )
    monkeypatch.setattr(web_server, "_profile_scope", profile_scope)
    monkeypatch.setattr(web_server, "load_config", lambda: {"model": {}})
    monkeypatch.setattr(web_server, "save_config", lambda config: saved.update(config))

    result = asyncio.run(
        web_server.activate_local_ollama(
            web_server.LocalOllamaSelection(model="qwen3:8b")
        )
    )

    assert result["auth"] == "none"
    assert saved["model"]["provider"] == "ollama-local"
    assert saved["model"]["default"] == "qwen3:8b"
    assert saved["model"]["base_url"] == "http://127.0.0.1:11434/v1"
    assert "api_key" not in saved["model"]
    assert "api_key" not in saved["providers"]["ollama-local"]
