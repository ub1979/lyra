#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PORT="${IDRAK_IT_PORT:-9119}"

cd "$PROJECT_DIR"

if ! command -v uv >/dev/null 2>&1; then
  echo "Error: uv is required but was not found."
  echo "Install it from https://docs.astral.sh/uv/ and run this script again."
  exit 1
fi

if [[ ! -x ".venv/bin/hermes" ]]; then
  echo "Preparing Idrak IT for the first run..."
  uv sync --extra dev
fi

echo "Enabling the Ultimate Builder plugin..."
uv run hermes plugins enable ultimate-builder >/dev/null

echo
echo "Starting Idrak IT at http://127.0.0.1:${PORT}"
echo "Use the App Builder tab to inspect projects."
echo "Use Chat and enter: /ultimate-build <what you want to build>"
echo "Press Ctrl+C here to stop the web application."
echo

exec uv run hermes dashboard --port "$PORT" "$@"
