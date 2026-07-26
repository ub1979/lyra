#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PORT="${IDRAK_IT_PORT:-9119}"

if ! command -v lsof >/dev/null 2>&1; then
  echo "Error: stop.sh needs lsof to identify Idrak IT safely."
  exit 1
fi

RUNNING_PID="$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null | head -n 1 || true)"

if [[ -z "$RUNNING_PID" ]]; then
  echo "Idrak IT is not running on port ${PORT}."
  exit 0
fi

RUNNING_CWD="$(
  lsof -a -p "$RUNNING_PID" -d cwd -Fn 2>/dev/null |
    sed -n 's/^n//p' |
    head -n 1
)"
RUNNING_COMMAND="$(ps -p "$RUNNING_PID" -o command= 2>/dev/null || true)"

if [[ "$RUNNING_CWD" != "$PROJECT_DIR" || "$RUNNING_COMMAND" != *"hermes dashboard"* ]]; then
  echo "Refusing to stop process ${RUNNING_PID}: it is not this Idrak IT application."
  echo "Port ${PORT} belongs to: ${RUNNING_COMMAND:-unknown process}"
  exit 1
fi

echo "Stopping Idrak IT..."
kill "$RUNNING_PID"

for _attempt in {1..50}; do
  if ! kill -0 "$RUNNING_PID" 2>/dev/null; then
    echo "Idrak IT stopped."
    exit 0
  fi
  sleep 0.1
done

echo "Idrak IT is taking longer than expected to stop."
echo "Process ${RUNNING_PID} is still running; no force-stop was attempted."
exit 1
