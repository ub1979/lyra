"""Requirements skill-shaped documents must survive the acceptance boundary."""

import importlib.util
from pathlib import Path

import pytest


def parse(text):
    spec = importlib.util.spec_from_file_location(
        "requirement_ids_test", Path(__file__).resolve().parents[1] / "requirement_ids.py"
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.declared_requirement_ids(text)


def test_skill_bullets_keep_parent_children_and_explicit_nonfunctional_scope():
    document = """# Requirements
- **FR-001 Arithmetic** — Support addition.
  - AC-001: Enter 2 + 3 and see 5.
  - AC-002: Negative values work.
- **NFR-003 Accessibility basics** — Display contrast meets 4.5:1.
See FR-099 for a narrative reference, not a declaration.
- See AC-999 for an example.
"""
    assert parse(document) == ["FR-001", "AC-001", "AC-002", "NFR-003"]


def test_tables_headings_and_numbered_declarations_can_coexist():
    assert parse("""| Requirement | ID |
| --- | --- |
| Keep records | FR-001 |

### NFR-002: Offline
1. **AC-003**: Reload a record.
""") == ["FR-001", "NFR-002", "AC-003"]


def test_examples_and_reference_tables_do_not_invent_criteria():
    assert parse("""```markdown
- FR-777: Example only
```
| ID | Evidence reference |
| AC-888 | old test |
- FR-001: Real requirement
""") == ["FR-001"]


@pytest.mark.parametrize("document", [
    "Plain prose without declarations",
    "- FR-001: One\n- FR-001: Duplicate",
    "- FR-001: Real\n```\n- FR-002: Unclosed example",
    "\n".join(f"- AC-{n}: Check" for n in range(257)),
])
def test_ambiguous_or_unbounded_input_requires_review(document):
    assert parse(document) == []
