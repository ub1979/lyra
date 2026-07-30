#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PORT="${LYRA_PORT:-9119}"

cd "$PROJECT_DIR"

if command -v lsof >/dev/null 2>&1; then
  RUNNING_PID="$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null | head -n 1 || true)"
  if [[ -n "$RUNNING_PID" ]]; then
    RUNNING_CWD="$(
      lsof -a -p "$RUNNING_PID" -d cwd -Fn 2>/dev/null |
        sed -n 's/^n//p' |
        head -n 1
    )"
    RUNNING_COMMAND="$(ps -p "$RUNNING_PID" -o command= 2>/dev/null || true)"

    if [[ "$RUNNING_CWD" == "$PROJECT_DIR" && "$RUNNING_COMMAND" == *"hermes dashboard"* ]]; then
      echo "Lyra is already running at http://127.0.0.1:${PORT}"
      echo "Open that address, or run ./stop.sh before restarting it."
      exit 0
    fi

    echo "Error: port ${PORT} is already being used by another application."
    echo "Choose another port with LYRA_PORT=9120 ./start.sh"
    exit 1
  fi
fi

if ! command -v uv >/dev/null 2>&1; then
  echo "Error: uv is required but was not found."
  echo "Install it from https://docs.astral.sh/uv/ and run this script again."
  exit 1
fi

if [[ ! -x ".venv/bin/hermes" ]]; then
  echo "Preparing Lyra for the first run..."
  uv sync --extra dev
fi

echo "Enabling the Ultimate Builder plugin..."
uv run hermes plugins enable ultimate-builder >/dev/null

# Optional: start LiveKit server for voice chat
if [[ "${LIVEKIT_ENABLED:-}" == "true" ]]; then
  if command -v livekit-server >/dev/null 2>&1; then
    echo "Starting LiveKit server for voice chat..."
    livekit-server --dev --bind 127.0.0.1 &
    LIVEKIT_PID=$!
    trap "kill $LIVEKIT_PID 2>/dev/null" EXIT
  else
    echo "Warning: LIVEKIT_ENABLED=true but livekit-server not found."
    echo "  Install: brew install livekit/tap/livekit-server"
  fi
fi

echo
echo "Starting Lyra at http://127.0.0.1:${PORT}"
echo "Choose New project or Open project in the browser, then start chatting."
echo "Lyra keeps technical terminal output behind the guided chat."
echo "Press Ctrl+C here to stop the web application."
echo

uv run hermes dashboard --port "$PORT" "$@"
