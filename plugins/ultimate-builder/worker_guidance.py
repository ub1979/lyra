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


def personal_qa_guidance() -> str:
    """Reduce model round trips, not the independently verified acceptance scope."""
    return (
        "Personal QA execution contract (takes precedence over the full campaign): "
        "independently run the existing automated test command, then map every "
        "approved core criterion to a small set of real user journeys. One recorded "
        "journey may cover several criteria; do not repeat the same passing flow "
        "only to give each story a separate test. Unit-tested numeric permutations "
        "stay in the automated suite after the real UI wiring is exercised. "
        "Retain real keyboard interaction, relevant invalid input, saved-state "
        "reload (or reset behavior for a stateless app), console and narrow-layout "
        "checks. Developer reports alone are not independent QA evidence.\n\n"
        "Browser execution: reuse the project's existing browser test command. "
        "If none exists but an installed browser automation runtime is available "
        "(for example Playwright), save one small project-local smoke script and "
        "run it through terminal. Drive actual sequential browser fill/click/key "
        "actions with assertions and bounded waits; collect console errors and "
        "results together. A failed assertion must make the command exit non-zero. "
        "Do not assign DOM values, call app functions, or fabricate events as a "
        "substitute for real keyboard/user actions. Do not spend a separate model "
        "turn inspecting the page after every keystroke or replay all logic tests "
        "through individual browser calls. Use an isolated browser context and "
        "temporary data, and close only your own processes.\n\n"
        "If no suitable runner is available, use the existing browser tools for "
        "the mapped journeys; gather related read-only assertions together after "
        "each journey. Do not loop through installs or invent a test framework. "
        "Missing required coverage stays BLOCKED, never silently skipped. Do not "
        "modify installed applications, grant broader OS permissions or bypass "
        "macOS protection for screenshots; record the blocker instead.\n\n"
        "Save evidence incrementally, reserve room in the existing call budget "
        "for the report and terminal job update, and use the existing handoff "
        "protocol if required checks cannot finish. After a repair rerun the "
        "automated suite and affected browser journeys. Write one concise "
        "bug-report.md plus raw task evidence, not repeated full reports in "
        "the Brain, ledger and class map; those should link to the evidence. "
        "Only passing approved core checks permit QA completion."
    )


def phase_guidance(phase: str, build_profile: str | None = None) -> str:
    """Return the guidance blocks for one phase job, separated by blank lines."""
    blocks = [ledger_guidance()]
    if phase in TESTING_PHASES:
        blocks.append(testing_guidance())
    if phase == "sw-developer" and build_profile == "personal":
        blocks.append(personal_development_guidance())
    if phase == "qa-engineer" and build_profile == "personal":
        blocks.append(personal_qa_guidance())
    if phase == "tech-writer" and build_profile == "personal":
        blocks.append(
            "Personal documentation outcome: deliver one concise README with how "
            "to run and test the approved app, essential usage, and known limitations. "
            "This phase scope overrides the playbook's default full documentation "
            "suite; still load the whole playbook and apply its relevant quality checks. "
            "Verify the documented commands and relevant examples. Reuse existing "
            "verified evidence where applicable. Do not add separate deployment, "
            "architecture, developer or troubleshooting guides, new runtime modes, "
            "screenshots or infrastructure unless the approved requirements need them."
        )
    return "\n\n".join(blocks)
