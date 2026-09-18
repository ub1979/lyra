"""Classify the user's answer to a preview checkpoint.

The answer arrives either as a clicked choice or as free text typed in the
composer. Only an unambiguous approval or skip may authorize building; any
other text is treated as a request for changes or as unclear, so it can never
be read as approval by accident.
"""

from __future__ import annotations

import re

APPROVE = "approve"
SKIP = "skip"
CHANGE = "change"
UNCLEAR = "unclear"

_APPROVE_WORDS = frozenset({"approve", "approved", "approve it"})
_SKIP_WORDS = frozenset({"skip", "skipped", "skip it", "start building"})
_CHANGE_WORDS = frozenset({"change", "changes", "make a preview first"})
# Any of these anywhere in the answer means the user is not simply agreeing,
# e.g. "don't approve yet" or "approve, but change the colours".
_HESITATION = re.compile(
    r"\b(?:not|don't|dont|do not|no|but|except|change|wait|later)\b"
)


def classify_preview_answer(answer: str) -> str:
    """Return APPROVE, SKIP, CHANGE or UNCLEAR for one user answer."""
    text = " ".join(str(answer or "").casefold().split()).strip(" .!")
    if not text:
        return UNCLEAR
    if text in _CHANGE_WORDS:
        return CHANGE
    if text in _APPROVE_WORDS or text in _SKIP_WORDS:
        return APPROVE if text in _APPROVE_WORDS else SKIP
    first_word = text.split(" ", 1)[0].strip(",;:")
    if _HESITATION.search(text):
        return CHANGE if first_word in {"change", "changes"} else UNCLEAR
    if first_word in {"approve", "approved"}:
        return APPROVE
    if first_word == "skip":
        return SKIP
    return UNCLEAR
