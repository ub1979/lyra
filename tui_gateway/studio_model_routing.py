"""Model ownership for the Studio coordinator, separate from worker pins."""

from collections.abc import Iterable, Mapping


def is_studio_coordinator(skills: Iterable[str]) -> bool:
    # Worker playbooks use ultimate-app-builder; only the user-facing entry
    # skill follows Studio's Main AI model selection.
    return "ultimate-builder:app-it" in skills


def studio_model_override(config: Mapping, skills: Iterable[str]) -> dict | None:
    """Use the user's saved pair, never a stale launch variable or chat model."""
    if not is_studio_coordinator(skills):
        return None
    model = config.get("model")
    if not isinstance(model, Mapping):
        return None
    name = str(model.get("default") or "").strip()
    provider = str(model.get("provider") or "").strip()
    if not name or not provider:
        return None
    return {"model": name, "provider": provider}
