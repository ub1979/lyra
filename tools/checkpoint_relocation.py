"""Preserve checkpoint ancestry when a project moves, without deleting old refs."""

import json
from pathlib import Path

from utils import atomic_json_write


def relocate_checkpoints(source: str, destination: str) -> bool:
    """Copy the ref with compare-and-swap; safe to retry after partial failure.

    The old ref stays recoverable. Normal retention can prune it later. A new
    path's unrelated history must never be overwritten by a move operation.
    """
    from tools import checkpoint_manager as cp

    old, new = cp._project_hash(source), cp._project_hash(destination)
    store = cp._store_path(cp.CHECKPOINT_BASE)
    if old == new or not (store / "HEAD").exists():
        return False
    destination = str(Path(destination).resolve())
    ok, old_head, error = cp._run_git(
        ["rev-parse", "--verify", cp._ref_name(old)],
        store,
        destination,
        allowed_returncodes={128},
    )
    if not ok:
        exists, refs, _ = cp._run_git(
            ["for-each-ref", "--format=%(refname)", cp._ref_name(old)],
            store,
            destination,
        )
        if not exists or refs.strip():
            raise OSError(error or "Could not read recovery history")
        return False
    old_head = old_head.strip()
    ok, new_head, _ = cp._run_git(
        ["rev-parse", "--verify", cp._ref_name(new)],
        store,
        destination,
        allowed_returncodes={128},
    )
    if ok and new_head.strip() != old_head:
        raise ValueError("The destination already has different recovery history")
    if not ok:
        saved, _, error = cp._run_git(
            ["update-ref", cp._ref_name(new), old_head, "0" * len(old_head)],
            store,
            destination,
        )
        if not saved:
            raise OSError(error or "Could not preserve recovery history")
    # The next snapshot reconstructs a fresh index. Preserve immutable ancestry.
    cp._register_project(store, destination)
    metadata_path = cp._project_meta_path(store, new)
    metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
    metadata["relocated_from"] = str(Path(source).resolve())
    atomic_json_write(metadata_path, metadata)
    return True
