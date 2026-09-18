"""Instructions every project worker needs before it starts.

Trial 3's Development worker used 46 of its 90 calls running a browser-only
test page through navigation and console reads, and 12 more searching for the
ledger format. These blocks give the worker the ledger format, a repeatable
test contract, and a lean procedure for a Personal project.
"""

from __future__ import annotations

import importlib.util
from pathlib import Path

# Phases that write or check application code and therefore run tests.
TESTING_PHASES = frozenset({"sw-developer", "debugger", "qa-engineer", "code-reviewer"})


def _ledger_seed():
    spec = importlib.util.spec_from_file_location(
        "lyra_ultimate_builder_progress_ledger_seed_for_guidance",
        Path(__file__).resolve().with_name("progress_ledger_seed.py"),
    )
    if spec is None or spec.loader is None:
        raise RuntimeError("Could not load the progress ledger format")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def ledger_guidance() -> str:
    seed = _ledger_seed()
    return (
        "Progress ledger format: `.sdlc/progress.md` holds a Markdown table with "
        "the columns `| Phase | Status | Evidence |`. Add or update your phase's "
        f"row, for example `{seed.LEDGER_EXAMPLE_ROW}`. Status words Lyra reads: "
        f"{', '.join(seed.STATUS_WORDS)}. Evidence is a project-relative path. "
        "Do not search Lyra's installation or other projects for this format."
    )


def testing_guidance() -> str:
    return (
        "Testing contract: use one repeatable terminal test command for this "
        "project (for example `npm test` or `node --test`) and record it in the "
        "Project Brain so later jobs reuse it. It must exit non-zero when a test "
        "fails; never pipe it through `tail`, `head`, `tee` or `|| true`. If the "
        "project has no test runner and should stay dependency-free, use Node's "
        "built-in runner (`node --test`) for logic modules; it needs no installed "
        "packages. Rerun the command after every repair. Use the browser for real "
        "user journeys, console and responsive checks, and repeat them when a "
        "defect or repair warrants it, but never as the loop for individual test "
        "assertions."
    )


def personal_development_guidance() -> str:
    return (
        "Personal project: the user chose a small personal build. Build the "
        "approved core path first and keep the approved design. Do not add "
        "production-only work such as deployment, design systems, release "
        "documents or extra infrastructure. Keep clear module boundaries, input "
        "validation and real tests. Finish with one real browser journey of the "
        "core flow, and repeat it after any repair that touches the interface. "
        "Commit verified work as you go so a later attempt can continue from it."
    )


def phase_guidance(phase: str, build_profile: str | None = None) -> str:
    """Return the guidance blocks for one phase job, separated by blank lines."""
    blocks = [ledger_guidance()]
    if phase in TESTING_PHASES:
        blocks.append(testing_guidance())
    if phase == "sw-developer" and build_profile == "personal":
        blocks.append(personal_development_guidance())
    return "\n\n".join(blocks)
