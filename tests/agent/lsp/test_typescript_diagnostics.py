"""Fresh clean/error diagnostics without notification or stale-clean shortcuts."""

import asyncio
import sys
import time
from pathlib import Path
from unittest.mock import AsyncMock

import pytest

from agent.lsp.client import LSPClient
from agent.lsp.typescript_diagnostics import pull_diagnostics, supports_pull

CAPABILITIES = {"capabilities": {"executeCommandProvider": {"commands": ["typescript.tsserverRequest"]}}}


def client_for(tmp_path):
    return LSPClient(server_id="typescript", workspace_root=str(tmp_path),
                     command=[sys.executable, str(Path(__file__).with_name("_typescript_lsp_server.py"))],
                     seed_diagnostics_on_first_push=True)


@pytest.mark.asyncio
async def test_stdio_clean_unchanged_error_fixed_never_waits_for_missing_push(tmp_path):
    path = tmp_path / "app.js"
    client = client_for(tmp_path)
    await client.start()
    try:
        for content, count in [("clean", 0), ("clean", 0), ("bad", 1), ("fixed", 0)]:
            path.write_text(content, encoding="utf-8")
            version = await client.open_file(str(path), language_id="javascript")
            await client.save_file(str(path))
            started = time.monotonic()
            assert await client.wait_for_diagnostics(str(path), version, timeout=1.0)
            assert time.monotonic() - started < 0.9
            assert len(client.diagnostics_for(str(path), fresh_only=True)) == count
    finally:
        await client.shutdown()


@pytest.mark.asyncio
async def test_changed_document_does_not_accept_an_inflight_old_pull(tmp_path):
    path = tmp_path / "app.js"
    path.write_text("clean", encoding="utf-8")
    client = client_for(tmp_path)
    await client.start()
    released, waiting = asyncio.Event(), asyncio.Event()
    real_request = client._send_request_with_retry

    async def delayed(*args, **kwargs):
        result = await real_request(*args, **kwargs)
        waiting.set()
        await released.wait()
        return result

    try:
        await client.open_file(str(path))
        client._send_request_with_retry = delayed
        old_pull = asyncio.create_task(client._pull_document_diagnostics(str(path)))
        await asyncio.wait_for(waiting.wait(), 1)
        path.write_text("bad", encoding="utf-8")
        version = await client.open_file(str(path))
        released.set()
        await old_pull
        assert not client._docs[str(path)].fresh_pull(version)
        client._send_request_with_retry = real_request
        assert await client.wait_for_diagnostics(str(path), version, timeout=1)
        assert len(client.diagnostics_for(str(path), fresh_only=True)) == 1
    finally:
        released.set()
        await client.shutdown()


@pytest.mark.parametrize("result", [None, {}, {"success": False, "body": []},
                                   {"success": True}, {"success": True, "body": [{}]}])
@pytest.mark.asyncio
async def test_missing_or_malformed_response_is_not_clean(result):
    request = AsyncMock(return_value=result)
    with pytest.raises(ValueError):
        await pull_diagnostics(request, "/project/a.js", 1)


def test_only_advertised_typescript_extension_used_and_standard_pull_preferred():
    assert supports_pull("typescript", CAPABILITIES)
    assert not supports_pull("pyright", CAPABILITIES)
    assert not supports_pull("typescript", None)
    assert not supports_pull("typescript", {"capabilities": {}})
    assert not supports_pull("typescript", {"capabilities": {
        **CAPABILITIES["capabilities"], "diagnosticProvider": {},
    }})


@pytest.mark.asyncio
async def test_conversion_retains_utf16_position_severity_and_tags():
    diagnostic = {"message": "Deprecated", "category": "warning", "code": 123,
                  "startLocation": {"line": 2, "offset": 4},
                  "endLocation": {"line": 2, "offset": 6}, "reportsDeprecated": True}
    request = AsyncMock(side_effect=[{"success": True, "body": [diagnostic]},
                                    {"success": True, "body": []}, {"success": True, "body": []}])
    result = await pull_diagnostics(request, "/project/a.js", 1)
    assert result["items"] == [{"message": "Deprecated", "severity": 2, "code": 123,
                               "source": "typescript", "tags": [2],
                               "range": {"start": {"line": 1, "character": 3},
                                         "end": {"line": 1, "character": 5}}}]


@pytest.mark.asyncio
async def test_outer_wait_deadline_still_bounds_an_unresponsive_server(tmp_path):
    path = tmp_path / "app.js"
    path.write_text("clean", encoding="utf-8")
    client = client_for(tmp_path)
    await client.start()
    try:
        version = await client.open_file(str(path))

        async def hangs(*args, **kwargs):
            await asyncio.sleep(30)

        client._send_request_with_retry = hangs
        started = time.monotonic()
        assert not await client.wait_for_diagnostics(str(path), version, timeout=0.1)
        assert time.monotonic() - started < 1
        assert not client._docs[str(path)].fresh_pull(version)
    finally:
        await client.shutdown()


def test_real_service_baseline_write_and_delta_keep_errors_visible(tmp_path, monkeypatch):
    from agent.lsp import servers
    from agent.lsp.manager import LSPService

    (tmp_path / ".git").mkdir()
    path = tmp_path / "app.js"
    path.write_text("clean", encoding="utf-8")
    replacement = servers.ServerDef(
        server_id="typescript", extensions=[".js"],
        resolve_root=lambda _path, workspace: workspace,
        build_spawn=lambda root, _ctx: servers.SpawnSpec(
            command=[sys.executable, str(Path(__file__).with_name("_typescript_lsp_server.py"))],
            workspace_root=root, cwd=root, seed_diagnostics_on_first_push=True,
        ),
        seed_first_push=True,
    )
    monkeypatch.setattr(servers, "SERVERS", [replacement])
    service = LSPService(enabled=True, wait_mode="document", wait_timeout=1, install_strategy="manual")
    try:
        service.snapshot_baseline(str(path))
        path.write_text("bad", encoding="utf-8")
        assert len(service.get_diagnostics_sync(str(path))) == 1
        service.snapshot_baseline(str(path))
        path.write_text("fixed", encoding="utf-8")
        assert service.get_diagnostics_sync(str(path)) == []
        assert not service._broken
    finally:
        service.shutdown()
