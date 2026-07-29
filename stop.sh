#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PORT="${LYRA_PORT:-9119}"

if ! command -v lsof >/dev/null 2>&1; then
  echo "Error: stop.sh needs lsof to identify Lyra safely."
  exit 1
fi

RUNNING_PID="$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null | head -n 1 || true)"

if [[ -z "$RUNNING_PID" ]]; then
  echo "Lyra is not running on port ${PORT}."
  exit 0
fi

RUNNING_CWD="$(
  lsof -a -p "$RUNNING_PID" -d cwd -Fn 2>/dev/null |
    sed -n 's/^n//p' |
    head -n 1
)"
RUNNING_COMMAND="$(ps -p "$RUNNING_PID" -o command= 2>/dev/null || true)"

if [[ "$RUNNING_CWD" != "$PROJECT_DIR" || "$RUNNING_COMMAND" != *"hermes dashboard"* ]]; then
  echo "Refusing to stop process ${RUNNING_PID}: it is not this Lyra application."
  echo "Port ${PORT} belongs to: ${RUNNING_COMMAND:-unknown process}"
  exit 1
fi

echo "Stopping Lyra..."

# The dashboard starts a PTY/TUI child in its own process group, so stopping
# only the listening Python process can leave both it and the launcher alive.
# Capture the verified process tree before sending any signals.
TARGET_PIDS=()

collect_descendants() {
  local parent_pid="$1"
  local child_pid
  while IFS= read -r child_pid; do
    [[ "$child_pid" =~ ^[0-9]+$ ]] || continue
    collect_descendants "$child_pid"
    TARGET_PIDS+=("$child_pid")
  done < <(pgrep -P "$parent_pid" 2>/dev/null || true)
}

collect_descendants "$RUNNING_PID"
TARGET_PIDS+=("$RUNNING_PID")

# `uv run` is the listener's parent rather than its child. Include it only
# after independently verifying both its directory and command.
LAUNCHER_PID="$(ps -p "$RUNNING_PID" -o ppid= 2>/dev/null | tr -d ' ' || true)"
if [[ "$LAUNCHER_PID" =~ ^[0-9]+$ ]] && [[ "$LAUNCHER_PID" -gt 1 ]]; then
  LAUNCHER_CWD="$(
    lsof -a -p "$LAUNCHER_PID" -d cwd -Fn 2>/dev/null |
      sed -n 's/^n//p' |
      head -n 1
  )"
  LAUNCHER_COMMAND="$(ps -p "$LAUNCHER_PID" -o command= 2>/dev/null || true)"
  if [[ "$LAUNCHER_CWD" == "$PROJECT_DIR" && "$LAUNCHER_COMMAND" == *"hermes dashboard"* ]]; then
    TARGET_PIDS+=("$LAUNCHER_PID")
  fi
fi

is_process_running() {
  local process_state
  process_state="$(ps -p "$1" -o state= 2>/dev/null | tr -d ' ' || true)"
  [[ -n "$process_state" && "$process_state" != Z* ]]
}

for target_pid in "${TARGET_PIDS[@]}"; do
  kill -TERM "$target_pid" 2>/dev/null || true
done

for _attempt in {1..50}; do
  STILL_RUNNING=()
  for target_pid in "${TARGET_PIDS[@]}"; do
    if is_process_running "$target_pid"; then
      STILL_RUNNING+=("$target_pid")
    fi
  done
  if [[ "${#STILL_RUNNING[@]}" -eq 0 ]]; then
    echo "Lyra stopped."
    exit 0
  fi
  sleep 0.1
done

echo "Lyra did not stop cleanly; force-stopping its remaining processes..."
for target_pid in "${STILL_RUNNING[@]}"; do
  kill -KILL "$target_pid" 2>/dev/null || true
done

for _attempt in {1..20}; do
  ANY_RUNNING=false
  for target_pid in "${STILL_RUNNING[@]}"; do
    if is_process_running "$target_pid"; then
      ANY_RUNNING=true
      break
    fi
  done
  if [[ "$ANY_RUNNING" == false ]]; then
    echo "Lyra stopped."
    exit 0
  fi
  sleep 0.1
done

echo "Error: Lyra could not be stopped. Remaining process IDs: ${STILL_RUNNING[*]}"
exit 1
