"""Pull fresh diagnostics through TypeScript's advertised server command.

typescript-language-server is push-only and deduplicates clean notifications.
Its existing tsserverRequest command provides a real verdict even when that
notification is absent. No second server, cached-clean shortcut or tool is used.
"""

from __future__ import annotations

_COMMAND = "typescript.tsserverRequest"
_CHECKS = ("syntacticDiagnosticsSync", "semanticDiagnosticsSync", "suggestionDiagnosticsSync")


def supports_pull(server_id: str, initialize_result: dict | None) -> bool:
    capabilities = (initialize_result or {}).get("capabilities") or {}
    return (
        server_id == "typescript"
        and "diagnosticProvider" not in capabilities
        and _COMMAND in (capabilities.get("executeCommandProvider") or {}).get("commands", [])
    )


def _position(location: dict) -> dict:
    if not isinstance(location, dict) or not all(
        type(location.get(key)) is int and location[key] > 0 for key in ("line", "offset")
    ):
        raise ValueError("TypeScript diagnostic is missing line positions")
    # TS protocol positions are one-based UTF-16, matching LSP after subtracting
    # one. Do not reinterpret offsets as Python Unicode code-point indices.
    return {"line": location["line"] - 1, "character": location["offset"] - 1}


def _diagnostic(item: dict) -> dict:
    if not isinstance(item, dict) or not isinstance(item.get("message"), str):
        raise ValueError("Malformed TypeScript diagnostic")
    result = {
        "range": {"start": _position(item.get("startLocation")),
                  "end": _position(item.get("endLocation"))},
        "message": item["message"],
        "severity": {"error": 1, "warning": 2, "suggestion": 4, "message": 3}.get(item.get("category"), 1),
        "source": "typescript",
    }
    if isinstance(item.get("code"), (int, str)):
        result["code"] = item["code"]
    tags = [tag for name, tag in (("reportsUnnecessary", 1), ("reportsDeprecated", 2)) if item.get(name)]
    if tags:
        result["tags"] = tags
    return result


async def pull_diagnostics(request, path: str, timeout: float) -> dict:
    """Return standard items only after every requested category succeeds.

    The caller owns version tagging, cancellation and its overall deadline.
    Missing/failed/malformed responses must not be converted to clean results.
    """
    items = []
    for check in _CHECKS:
        response = await request("workspace/executeCommand", {
            "command": _COMMAND,
            "arguments": [check, {"file": path, "includeLinePosition": True}],
        }, timeout=timeout)
        if (not isinstance(response, dict) or response.get("success") is not True
                or not isinstance(response.get("body"), list)):
            raise ValueError("TypeScript did not provide a complete diagnostic result")
        items.extend(_diagnostic(item) for item in response["body"])
    return {"items": items}
