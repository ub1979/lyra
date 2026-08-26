from __future__ import annotations

import asyncio
import importlib.util
import sys
from pathlib import Path

import pytest
from fastapi import HTTPException


MODULE_PATH = Path(__file__).resolve().parents[1] / "dashboard" / "plugin_api.py"


def load_preview_api():
    name = "ultimate_builder_preview_api_test"
    spec = importlib.util.spec_from_file_location(name, MODULE_PATH)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


def test_preview_url_only_allows_loopback():
    module = load_preview_api()
    assert module._loopback_preview_url("localhost:5173") == "http://localhost:5173"
    assert module._loopback_preview_url("http://127.0.0.1:3000/app") == (
        "http://127.0.0.1:3000/app"
    )
    with pytest.raises(HTTPException, match="loopback"):
        module._loopback_preview_url("https://example.com")
    with pytest.raises(HTTPException, match="loopback"):
        module._loopback_preview_url("http://user:secret@localhost:3000")


def test_preview_html_rewrites_root_assets_and_adds_bridge():
    module = load_preview_api()
    result = module._preview_html(
        '<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src none"><script type="module" src="/src/main.tsx"></script></head><body><a href="/pricing">Plans</a></body></html>',
        "http://localhost:5173/dashboard",
        "bridge-test-token",
    )
    assert '<base href="http://localhost:5173/dashboard">' in result
    assert 'src="http://localhost:5173/src/main.tsx"' in result
    assert 'href="http://localhost:5173/pricing"' in result
    assert "Content-Security-Policy" not in result
    assert "window.__LYRA_APP_PREVIEW__" in result
    assert "bridge-test-token" in result


def test_preview_document_protects_lyra_checkout(monkeypatch):
    module = load_preview_api()

    async def should_not_fetch(_url: str):
        raise AssertionError("protected workspaces must fail before fetching")

    monkeypatch.setattr(module, "_fetch_preview_document", should_not_fetch)
    payload = module.PreviewDocumentRequest(
        url="http://localhost:3000",
        workspace=str(module._LYRA_CHECKOUT),
    )
    with pytest.raises(HTTPException, match="protected"):
        asyncio.run(module.preview_document(payload))


def test_preview_document_returns_prepared_local_html(tmp_path, monkeypatch):
    module = load_preview_api()

    async def fake_fetch(url: str):
        assert url == "http://localhost:3000"
        return "<html><head></head><body><button>Save</button></body></html>", url

    monkeypatch.setattr(module, "_fetch_preview_document", fake_fetch)
    payload = module.PreviewDocumentRequest(
        url="localhost:3000",
        workspace=str(tmp_path),
    )
    result = asyncio.run(module.preview_document(payload))
    assert result["url"] == "http://localhost:3000"
    assert "<button>Save</button>" in result["html"]
    assert "window.__LYRA_APP_PREVIEW__" in result["html"]
    assert result["bridge_token"] in result["html"]
