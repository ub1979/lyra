"""Push-only TypeScript protocol fixture using the shared real stdio framer."""
from _mock_lsp_server import read_message, write_message


def main():
    text = ""
    while message := read_message():
        method = message.get("method")
        params = message.get("params") or {}
        if method == "initialize":
            result = {"capabilities": {"textDocumentSync": 1, "executeCommandProvider": {
                "commands": ["typescript.tsserverRequest"],
            }}}
        elif method in {"textDocument/didOpen", "textDocument/didChange"}:
            text = (params["textDocument"].get("text", "") if method.endswith("didOpen")
                    else params["contentChanges"][0]["text"])
            # Mimic deduplicated notifications: no push for clean documents.
            continue
        elif method == "workspace/executeCommand":
            check = params["arguments"][0]
            body = []
            if "bad" in text and check == "syntacticDiagnosticsSync":
                body = [{"message": "Expression expected.", "category": "error", "code": 1109,
                         "startLocation": {"line": 1, "offset": 2},
                         "endLocation": {"line": 1, "offset": 3}}]
            result = {"success": True, "body": body}
        elif method == "shutdown":
            result = None
        elif method == "exit":
            return
        elif "id" in message:
            write_message({"jsonrpc": "2.0", "id": message["id"],
                           "error": {"code": -32601, "message": "Unsupported"}})
            continue
        else:
            continue
        write_message({"jsonrpc": "2.0", "id": message["id"], "result": result})


if __name__ == "__main__":
    main()
