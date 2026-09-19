"""Extract declared requirement IDs without treating narrative references as scope.

Accept the table form and the bullet/heading form shipped by Requirements.
Keep parent FRs and child ACs: shared evidence is allowed, silently dropping a
parent or an explicit NFR is not. Ambiguous declarations require review.
"""

from __future__ import annotations

import re

MAX_CRITERIA = 256
_ID = r"[A-Z][A-Z0-9_-]{0,30}-[0-9]{1,6}"
_DECLARATION = re.compile(
    r"^\s*(?:[-*+]\s+|\d+[.)]\s+|#{1,6}\s+)"
    rf"(?:\*\*|`)?({_ID})(?:\*\*|`)?"
    r"(?:\s*[:—–-]\s*|\s+)(\S.*)$"
)


def declared_requirement_ids(markdown: str) -> list[str]:
    """Return document-order declarations, or [] for unknown/ambiguous input."""
    found: list[str] = []
    id_column = None
    fence = None
    for line in markdown.splitlines():
        stripped = line.lstrip()
        if stripped.startswith(("```", "~~~")):
            marker = stripped[:3]
            if fence is None:
                fence = marker
            elif fence == marker:
                fence = None
            id_column = None
            continue
        if fence:
            continue
        if stripped.startswith("|"):
            cells = [cell.strip().strip("`* ") for cell in line.strip().strip("|").split("|")]
            header = [cell.lower() for cell in cells]
            if "id" in header and any("requirement" in cell or "criterion" in cell for cell in header):
                id_column = header.index("id")
            elif id_column is not None and len(cells) > id_column:
                value = cells[id_column]
                if re.fullmatch(_ID, value):
                    found.append(value)
        else:
            id_column = None
            match = _DECLARATION.match(line)
            if match:
                found.append(match[1])
        if len(found) > MAX_CRITERIA:
            return []
    if fence or len(found) != len(set(found)):
        return []
    return found
