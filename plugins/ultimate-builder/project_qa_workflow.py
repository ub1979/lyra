"""Choose complete QA skills and dependent work items for one project profile.

The saved work-item ids pin a campaign's shape across coordinator reconnects.
Legacy campaigns remain on the existing procedure; there is no data migration.
"""

from __future__ import annotations

import importlib.util
from pathlib import Path
from typing import Any, Iterable


PROFILES = ("personal", "reusable", "production")
EVIDENCE_SKILL = "ultimate-builder:qa-evidence"


def _legacy_plan(profile: str | None) -> dict[str, Any]:
    spec = importlib.util.spec_from_file_location(
        "lyra_legacy_qa_units", Path(__file__).with_name("project_work_units.py")
    )
    if spec is None or spec.loader is None:
        raise RuntimeError("Could not load the saved legacy QA procedure")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.load_qa_work_units(profile)


def _unit_id(profile: str, scope: str) -> str:
    return f"QA-{profile.upper()}-{scope.upper()}-001"


def load_qa_work_units(
    build_profile: str | None = None,
    *,
    existing_units: Iterable[tuple[str, str]] = (),
    qa_experience: bool = False,
    force_new: bool = False,
) -> dict[str, Any]:
    """Pin existing plans; an explicit fresh completed Personal pass may add UX.

    ``qa_experience`` adds coverage, never removes profile-required coverage.
    Do not change an existing job's final-item instruction by appending work to
    it: expansion requires a fresh pass after the old jobs have finished.
    """
    if build_profile not in (None, *PROFILES):
        raise ValueError("Unknown build profile")
    if not isinstance(qa_experience, bool):
        raise ValueError("qa_experience must be a boolean")
    saved = list(existing_units)
    ids = {unit_id for unit_id, _ in saved}
    if "QA-MVP-001" in ids or any(unit_id.startswith("QA-00") for unit_id in ids):
        if qa_experience:
            raise ValueError("Saved legacy QA keeps its scope; it cannot add Experience QA in place.")
        return _legacy_plan("personal" if "QA-MVP-001" in ids else None)

    profile = build_profile
    for candidate in PROFILES:
        if _unit_id(candidate, "functional") in ids:
            profile = candidate
            break
    if profile is None:
        if qa_experience:
            raise ValueError("Select a build_profile before adding Experience QA")
        return _legacy_plan(None)

    functional_id = _unit_id(profile, "functional")
    experience_id = _unit_id(profile, "experience")
    with_experience = profile != "personal" or experience_id in ids or qa_experience
    if functional_id in ids and experience_id not in ids and with_experience:
        if not force_new or any(status not in {"done", "archived"} for _, status in saved):
            raise ValueError(
                "QA scope is already queued. Finish the current pass, then use "
                "force_new=true with qa_experience=true for a fresh combined pass."
            )

    functional = {
        "id": functional_id,
        "title": "Functional QA — verify approved behaviour",
        "section": (
            f"Build profile: {profile}. Run Functional QA with the shared evidence "
            "contract. Reuse setup, independently run automated checks, and test "
            "the approved behaviour through the real entry point (real browser "
            "for UI apps), including errors, reload/reset, keyboard and narrow layout. "
            "Write .sdlc/qa-functional.md and raw task evidence. "
            + ("Experience QA follows; leave the overall QA phase in progress."
               if with_experience else
               "This is Functional-only QA. Write bug-report.md with the scoped "
               "verdict and state that deeper Experience QA was not selected.")
        ),
        "parents": [], "accepted": False, "final": not with_experience,
        "skills": [EVIDENCE_SKILL, "ultimate-builder:qa-functional"],
        "build_profile": profile,
    }
    units = [functional]
    if with_experience:
        units.append({
            "id": experience_id,
            "title": "Experience QA — verify usability and assemble verdict",
            "section": (
                f"Build profile: {profile}. Run Experience QA with the shared evidence "
                "contract. Reuse Functional QA's setup and .sdlc/qa-functional.md; "
                "do not repeat valid functional checks. Test applicable layout, "
                "interaction, copy and accessibility requirements. Save "
                ".sdlc/qa-experience.md. Check both scopes against the current "
                "revision before writing the combined bug-report.md verdict. "
                "Required untested work or serious defects block approval."
            ),
            "parents": [functional_id], "accepted": False, "final": True,
            "skills": [EVIDENCE_SKILL, "ultimate-builder:qa-experience"],
            "build_profile": profile,
        })
    return {"source": "ultimate-builder focused QA contract", "units": units}
