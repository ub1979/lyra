"""Versioned contract and validation for Lyra's Ultimate Builder workflow."""

from __future__ import annotations

import importlib.util
import json
import re
from pathlib import Path
from typing import Any


PLUGIN_ROOT = Path(__file__).resolve().parent
REPOSITORY_ROOT = PLUGIN_ROOT.parents[1]
CONTRACT_PATH = PLUGIN_ROOT / "workflow_contract.json"


def load_contract(path: Path = CONTRACT_PATH) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError("workflow contract root must be an object")
    return value


def validate_contract(
    contract: dict[str, Any] | None = None,
    *,
    repository_root: Path = REPOSITORY_ROOT,
    plugin_root: Path = PLUGIN_ROOT,
) -> list[str]:
    """Return deterministic contract and active-playbook validation errors."""
    value = load_contract() if contract is None else contract
    errors: list[str] = []
    if value.get("schema_version") != 1:
        errors.append("schema_version must be 1")
    if not re.fullmatch(r"\d+\.\d+\.\d+", str(value.get("contract_version") or "")):
        errors.append("contract_version must use MAJOR.MINOR.PATCH")

    rules = value.get("rules")
    if not isinstance(rules, list) or not rules:
        errors.append("rules must be a non-empty list")
        rules = []
    seen: set[str] = set()
    for index, rule in enumerate(rules):
        if not isinstance(rule, dict):
            errors.append(f"rules[{index}] must be an object")
            continue
        rule_id = str(rule.get("id") or "").strip()
        if not rule_id:
            errors.append(f"rules[{index}] has no id")
        elif rule_id in seen:
            errors.append(f"duplicate rule id: {rule_id}")
        seen.add(rule_id)
        if rule.get("mode") not in {"enforced", "exhorted"}:
            errors.append(f"{rule_id or index}: mode must be enforced or exhorted")
        evidence = rule.get("evidence")
        if not isinstance(evidence, list) or not evidence:
            errors.append(f"{rule_id or index}: evidence must be a non-empty list")
            continue
        for raw_path in evidence:
            path = repository_root / str(raw_path)
            try:
                inside = path.resolve(strict=False).is_relative_to(
                    repository_root.resolve()
                )
            except (OSError, RuntimeError):
                inside = False
            if not inside or not path.is_file():
                errors.append(f"{rule_id or index}: missing rule evidence {raw_path}")

    tool_contract = value.get("tool_contract")
    if not isinstance(tool_contract, dict):
        errors.append("tool_contract must be an object")
        tool_contract = {}
    forbidden = tool_contract.get("forbidden_playbook_terms", [])
    if not isinstance(forbidden, list):
        errors.append("tool_contract.forbidden_playbook_terms must be a list")
        forbidden = []
    elif not forbidden or any(
        not isinstance(term, str) or not term for term in forbidden
    ):
        errors.append("tool_contract.forbidden_playbook_terms must contain strings")
    skills_root = plugin_root / "skills"
    if not skills_root.is_dir():
        errors.append("active playbook directory is missing")
    for playbook in sorted(skills_root.rglob("SKILL.md")):
        text = playbook.read_text(encoding="utf-8")
        for term in forbidden:
            if str(term).casefold() in text.casefold():
                relative = playbook.relative_to(repository_root)
                errors.append(f"{relative}: foreign-runtime term {term!r}")

    state = value.get("state")
    if not isinstance(state, dict):
        errors.append("state must be an object")
    else:
        for key in ("canonical", "derived", "legacy_read_only", "candidates"):
            if key not in state:
                errors.append(f"state.{key} is required")

    policy = value.get("trivial_change")
    if not isinstance(policy, dict):
        errors.append("trivial_change must be an object")
    else:
        for key in ("maximum_changed_lines", "maximum_edit_distance_per_line"):
            if type(policy.get(key)) is not int or policy[key] <= 0:
                errors.append(f"trivial_change.{key} must be a positive integer")
        for key in ("allowed_kinds", "excluded_names"):
            if not isinstance(policy.get(key), list) or not policy[key]:
                errors.append(f"trivial_change.{key} must be a non-empty list")
        allowed = policy.get("allowed_kinds")
        known_kinds = {"documentation-prose", "python-comment", "slash-comment"}
        if isinstance(allowed, list) and not set(allowed).issubset(known_kinds):
            errors.append("trivial_change.allowed_kinds contains an unknown kind")
    return errors


def contract_report(contract: dict[str, Any] | None = None) -> dict[str, Any]:
    """Expose the enforced/exhorted ratio without pretending it is coverage."""
    value = load_contract() if contract is None else contract
    rules = value.get("rules") if isinstance(value.get("rules"), list) else []
    enforced = sum(
        isinstance(rule, dict) and rule.get("mode") == "enforced" for rule in rules
    )
    exhorted = sum(
        isinstance(rule, dict) and rule.get("mode") == "exhorted" for rule in rules
    )
    total = enforced + exhorted
    errors = validate_contract(value)
    return {
        "ok": not errors,
        "schema_version": value.get("schema_version"),
        "contract_version": value.get("contract_version"),
        "declared_rules": total,
        "enforced": enforced,
        "exhorted": exhorted,
        "enforced_ratio": round(enforced / total, 4) if total else 0.0,
        "errors": errors,
        "note": "The ratio covers declared critical workflow rules, not every sentence in every playbook.",
    }


def assert_valid_contract() -> None:
    errors = validate_contract()
    if errors:
        raise RuntimeError(
            "Invalid Ultimate Builder workflow contract: " + "; ".join(errors)
        )


def _adjacent_module(name: str):
    path = Path(__file__).resolve().with_name(f"{name}.py")
    spec = importlib.util.spec_from_file_location(f"lyra_{name}_contract_facade", path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Could not load {name}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def reconcile_legacy_debug_learnings(project: str | Path) -> dict[str, Any]:
    """Expose the non-destructive learning migration through one contract API."""
    return _adjacent_module("project_learnings").reconcile_legacy_debug_learnings(
        project
    )


def classify_trivial_change(project: str | Path) -> dict[str, Any]:
    """Expose the conservative classifier through one contract API."""
    contract = load_contract()
    errors = validate_contract(contract)
    if errors:
        return {
            "trivial": False,
            "change_record_required": True,
            "reason": "workflow contract is invalid",
            "errors": errors,
        }
    return _adjacent_module("trivial_change").classify_trivial_change(
        project, contract["trivial_change"]
    )
