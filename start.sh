#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_DIR="$PROJECT_DIR/my_projects"
PORT="${LYRA_PORT:-9119}"

cd "$PROJECT_DIR"
mkdir -p "$WORKSPACE_DIR"

if command -v lsof >/dev/null 2>&1; then
  RUNNING_PID="$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null | head -n 1 || true)"
  if [[ -n "$RUNNING_PID" ]]; then
    RUNNING_CWD="$(
      lsof -a -p "$RUNNING_PID" -d cwd -Fn 2>/dev/null |
        sed -n 's/^n//p' |
        head -n 1
    )"
    RUNNING_COMMAND="$(ps -p "$RUNNING_PID" -o command= 2>/dev/null || true)"

    if [[ "$RUNNING_CWD" == "$WORKSPACE_DIR" && "$RUNNING_COMMAND" == *"hermes dashboard"* ]]; then
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

# Long project phases run through Hermes' durable Kanban dispatcher. Messaging
# users already have a gateway service; local-only Lyra users need the same
# worker host while this launcher is running. Start one only when no dispatcher
# is currently healthy, and clean up only the process this launcher owns.
dispatcher_is_ready() {
  uv run --project "$PROJECT_DIR" python -c \
    'from hermes_cli.kanban import _check_dispatcher_presence; print("ready" if _check_dispatcher_presence()[0] else "missing")' \
    2>/dev/null | tail -n 1 | grep -qx "ready"
}

LYRA_GATEWAY_PID=""
if ! dispatcher_is_ready; then
  echo "Starting Lyra's recoverable project worker..."
  uv run --project "$PROJECT_DIR" hermes gateway run --external-supervisor &
  LYRA_GATEWAY_PID="$!"
  for _attempt in {1..100}; do
    if dispatcher_is_ready; then
      break
    fi
    if ! kill -0 "$LYRA_GATEWAY_PID" 2>/dev/null; then
      LYRA_GATEWAY_PID=""
      break
    fi
    sleep 0.2
  done
  if ! dispatcher_is_ready; then
    echo "Warning: the recoverable project worker did not start."
    echo "Lyra will still open, but saved background phases will wait until the gateway is available."
  fi
fi

cleanup_lyra_worker() {
  if [[ -n "$LYRA_GATEWAY_PID" ]] && kill -0 "$LYRA_GATEWAY_PID" 2>/dev/null; then
    kill -TERM "$LYRA_GATEWAY_PID" 2>/dev/null || true
    wait "$LYRA_GATEWAY_PID" 2>/dev/null || true
  fi
}
trap cleanup_lyra_worker EXIT INT TERM

echo
echo "Starting Lyra at http://127.0.0.1:${PORT}"
echo "Choose New project or Open project in the browser, then start chatting."
echo "Lyra keeps technical terminal output behind the guided chat."
echo "Press Ctrl+C here to stop the web application."
echo

# The dashboard's working directory becomes the default workspace for chats and
# the App Builder. Keep it outside Lyra's tracked source tree so an ordinary
# build cannot rewrite Lyra itself and leave users with a blocked `git pull`.
cd "$WORKSPACE_DIR"
uv run --project "$PROJECT_DIR" hermes dashboard --port "$PORT" "$@" &
LYRA_DASHBOARD_PID="$!"
wait "$LYRA_DASHBOARD_PID"
