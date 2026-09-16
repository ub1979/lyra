"""A collection of individually allowed reads must not bypass the batch budget."""

from copy import deepcopy

from tools.budget_config import DEFAULT_BUDGET, BudgetConfig
from tools.inline_result_admission import admit_inline_results
from tools.tool_result_storage import enforce_turn_budget, maybe_persist_tool_result
from tui_gateway.studio_budget import coordinator_budget


def message(content, index=0, name="read_file"):
    return {"role": "tool", "name": name, "tool_call_id": str(index), "content": content}


def test_many_reads_keep_first_brain_whole_and_defer_excess_without_losing_ids(tmp_path):
    budget = coordinator_budget(DEFAULT_BUDGET)
    brain = tmp_path / "project-brain.md"
    body = "User decision: offline only.\n" * 600
    brain.write_text(body, encoding="utf-8")
    original = [message(brain.read_text(encoding="utf-8"), i) for i in range(10)]
    batch = deepcopy(original)
    for msg in batch:
        msg["content"] = maybe_persist_tool_result(
            msg["content"], "read_file", msg["tool_call_id"], config=budget,
        )
    enforce_turn_budget(batch, config=budget)
    assert batch[0]["content"] == body
    assert sum(len(msg["content"]) for msg in batch) <= budget.turn_budget
    assert all(msg["content"] == body or "Result omitted" in msg["content"] for msg in batch)
    assert [msg["tool_call_id"] for msg in batch] == [msg["tool_call_id"] for msg in original]
    # No source deletion or partial-document substitution; a later read is whole.
    later = [message(brain.read_text(encoding="utf-8"))]
    enforce_turn_budget(later, config=budget)
    assert later[0]["content"] == body
    assert original[1]["content"] == body


def test_small_results_can_follow_a_deferred_large_result():
    config = BudgetConfig(turn_budget=500, inline_caps={"read_file": 1000})
    batch = [message("a" * 700), message("needed", 1)]
    admit_inline_results(batch, config)
    assert "Result omitted" in batch[0]["content"]
    assert batch[1]["content"] == "needed"


def test_default_workers_and_uncapped_instruction_tools_are_unchanged():
    batch = [message("a" * 24000, i) for i in range(10)]
    original = deepcopy(batch)
    admit_inline_results(batch, DEFAULT_BUDGET)
    assert batch == original
    skills = [message("instructions" * 10000, name="skill_view")]
    original = deepcopy(skills)
    admit_inline_results(skills, coordinator_budget(DEFAULT_BUDGET))
    assert skills == original


def test_tiny_budget_and_many_calls_still_preserve_call_structure():
    batch = [message("large result", i) for i in range(100)]
    config = BudgetConfig(turn_budget=50, inline_caps={"read_file": 100})
    admit_inline_results(batch, config)
    assert len(batch) == 100
    assert sum(len(msg["content"]) for msg in batch) <= 50
