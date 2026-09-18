"""Checks that must pass before any project job is created.

Both run before the queue touches the project or the board, so a refusal
never leaves partial work behind:

1. Reusable and Production Development needs a task plan (one job per work
   item, never one whole-application job).
2. The first Development job needs the user's own preview decision.

Projects that already have a Development job are exempt from both, so
resumed, retried and repair work keeps its existing behavior.
"""

from __future__ import annotations

import importlib.util
from pathlib import Path
from typing import Any

_ROOT = Path(__file__).resolve().parent


def _sibling(name: str) -> Any:
    spec = importlib.util.spec_from_file_location(
        f"lyra_ultimate_builder_{name}_for_queue_guards", _ROOT / f"{name}.py"
    )
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Could not load {name}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def assert_queue_allowed(
    project: Path,
    requested: list[str],
    build_profile: str | None,
    *,
    has_existing_development: bool,
    has_work_units: bool,
) -> None:
    """Raise ValueError (plan) or PermissionError (preview); otherwise return."""
    if "sw-developer" not in requested or has_existing_development:
        return
    plan_refusal = _sibling("attempt_ceilings").missing_task_plan_refusal(
        build_profile,
        requested,
        has_work_units=has_work_units,
        has_existing_development=has_existing_development,
    )
    if plan_refusal:
        raise ValueError(plan_refusal)
    preview_refusal = _sibling("preview_authorization").development_refusal(project)
    if preview_refusal:
        raise PermissionError(preview_refusal)
