#!/usr/bin/env bash
set -Eeuo pipefail

CURRENT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
COMPARISON_BRANCH="codex/aug28-ui-brain"
DEFAULT_OLD_DIR="$(cd -- "$CURRENT_DIR/.." && pwd)/lyra-aug28-ui-brain"
OLD_DIR="${LYRA_OLD_DIR:-}"

# Prefer the exact registered Git worktree, so this keeps working if the
# comparison checkout is moved away from its original sibling directory.
if [[ -z "$OLD_DIR" ]] && command -v git >/dev/null 2>&1; then
  CANDIDATE=""
  while IFS= read -r line; do
    case "$line" in
      "worktree "*)
        CANDIDATE="${line#worktree }"
        ;;
      "branch refs/heads/$COMPARISON_BRANCH")
        OLD_DIR="$CANDIDATE"
        break
        ;;
    esac
  done < <(git -C "$CURRENT_DIR" worktree list --porcelain 2>/dev/null || true)
fi

if [[ -z "$OLD_DIR" ]]; then
  OLD_DIR="$DEFAULT_OLD_DIR"
fi

if [[ ! -x "$OLD_DIR/start.sh" ]]; then
  echo "Error: the August 28 comparison checkout was not found."
  echo "Expected it at: $OLD_DIR"
  echo
  echo "Create it once with:"
  echo "  git -C \"$CURRENT_DIR\" fetch origin"
  echo "  git -C \"$CURRENT_DIR\" worktree add \"$DEFAULT_OLD_DIR\" $COMPARISON_BRANCH"
  exit 1
fi

OLD_BRANCH="$(git -C "$OLD_DIR" branch --show-current 2>/dev/null || true)"
if [[ "$OLD_BRANCH" != "$COMPARISON_BRANCH" ]]; then
  echo "Error: $OLD_DIR is on '$OLD_BRANCH', not '$COMPARISON_BRANCH'."
  echo "Refusing to start the wrong Lyra version."
  exit 1
fi

# Current Lyra uses 9119. The comparison version defaults to 9120 so both can
# run at once. LYRA_OLD_PORT can override only the comparison port.
export LYRA_PORT="${LYRA_OLD_PORT:-9120}"

echo "Starting August 28 Lyra from: $OLD_DIR"
echo "Comparison address: http://127.0.0.1:${LYRA_PORT}"
echo

exec "$OLD_DIR/start.sh" "$@"
