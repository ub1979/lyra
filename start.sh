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
  echo "This downloads and compiles Python dependencies and can take"
  echo "5-20 minutes on a new machine. It only happens once."
  uv sync --extra dev
fi

# Do NOT silence this. It used to be `>/dev/null`, which meant the slowest
# step of a cold start - uv resolving the environment, then Hermes scanning
# skills and plugins - printed the "Enabling..." line and then produced no
# output at all for minutes. Every report of "it got stuck on startup" landed
# in this gap. Showing the work is the difference between slow and hung.
echo "Enabling the Ultimate Builder plugin..."
uv run hermes plugins enable ultimate-builder

echo
echo "Starting Lyra at http://127.0.0.1:${PORT}"
echo "Choose New project or Open project in the browser, then start chatting."
echo "Lyra keeps technical terminal output behind the guided chat."
echo "Press Ctrl+C here to stop the web application."
echo

exec uv run hermes dashboard --port "$PORT" "$@"
