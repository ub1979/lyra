"""CLI adapter for durable Lyra project jobs."""

from __future__ import annotations

import argparse
import importlib.util
from pathlib import Path


def _project_runs_module():
    path = Path(__file__).resolve().with_name("project_runs.py")
    spec = importlib.util.spec_from_file_location("lyra_project_run_cli_core", path)
    if spec is None or spec.loader is None:
        raise RuntimeError("Could not load durable project jobs")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def setup_parser(parser: argparse.ArgumentParser) -> None:
    sub = parser.add_subparsers(dest="project_run_command", required=True)
    queue = sub.add_parser(
        "queue", help="Save project phases as recoverable background jobs"
    )
    queue.add_argument("--workspace", required=True)
    queue.add_argument("--phases", required=True, help="Comma-separated specialist ids")
    queue.add_argument("--assignee", default=None)
    queue.add_argument("--model", action="append", default=[], help="phase=model")
    queue.add_argument("--provider", action="append", default=[], help="phase=provider")
    queue.add_argument("--force-new", action="store_true")
    status = sub.add_parser("status", help="Read durable project-job state")
    status.add_argument("--workspace", required=True)
    for action in ("pause", "resume", "stop"):
        control = sub.add_parser(action, help=f"{action.title()} project jobs")
        control.add_argument("--workspace", required=True)


def _mapping(values: list[str]) -> dict[str, str]:
    result: dict[str, str] = {}
    for value in values:
        key, separator, item = value.partition("=")
        if not separator or not key.strip() or not item.strip():
            raise ValueError(f"Expected phase=value, got {value!r}")
        result[key.strip()] = item.strip()
    return result


def handle(args: argparse.Namespace) -> None:
    project_runs = _project_runs_module()
    if args.project_run_command == "queue":
        result = project_runs.queue_project_run(
            args.workspace,
            args.phases.split(","),
            assignee=args.assignee,
            models=_mapping(args.model),
            providers=_mapping(args.provider),
            force_new=args.force_new,
        )
    elif args.project_run_command == "status":
        result = project_runs.project_run_state(args.workspace)
    else:
        result = project_runs.control_project_run(
            args.workspace, args.project_run_command
        )
    project_runs.print_json(result)
