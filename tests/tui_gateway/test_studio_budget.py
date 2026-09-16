"""The coordinator's context stays small; workers keep the normal tool budget."""

from types import SimpleNamespace

from agent.tool_executor import _budget_for_agent
from tools.budget_config import DEFAULT_BUDGET, BudgetConfig, budget_for_context_window
from tools.tool_result_storage import maybe_persist_tool_result
from tui_gateway.studio_budget import (
    COORDINATOR_INLINE_CAPS,
    COORDINATOR_PRUNE_MIN_RESULT_CHARS,
    COORDINATOR_READ_FILE_CHARS,
    COORDINATOR_RESULT_CHARS,
    COORDINATOR_TURN_CHARS,
    apply_coordinator_context_policy,
    coordinator_budget,
)

COORDINATOR = ["ultimate-builder:app-it"]
WORKER = ["ultimate-builder:ultimate-app-builder"]


def test_coordinator_budget_tightens_but_never_loosens():
    tight = coordinator_budget(DEFAULT_BUDGET)
    assert tight.default_result_size == COORDINATOR_RESULT_CHARS
    assert tight.turn_budget == COORDINATOR_TURN_CHARS
    assert tight.inline_caps == COORDINATOR_INLINE_CAPS

    small_model = budget_for_context_window(4_000)
    assert coordinator_budget(small_model).default_result_size == min(
        small_model.default_result_size, COORDINATOR_RESULT_CHARS
    )
    assert coordinator_budget(small_model).turn_budget <= small_model.turn_budget


def test_budget_for_agent_routes_only_the_marked_coordinator():
    compressor = SimpleNamespace(context_length=200_000)
    coordinator = SimpleNamespace(context_compressor=compressor, _studio_coordinator=True)
    worker = SimpleNamespace(context_compressor=compressor)

    assert _budget_for_agent(coordinator).default_result_size == COORDINATOR_RESULT_CHARS
    assert _budget_for_agent(worker) == DEFAULT_BUDGET


def test_pinned_read_file_is_still_truncated_inline_for_the_coordinator():
    budget = coordinator_budget(DEFAULT_BUDGET)
    huge = "line\n" * 20_000

    kept = maybe_persist_tool_result(huge, "read_file", "call-1", env=None, config=budget)

    assert len(kept) < COORDINATOR_READ_FILE_CHARS + 300
    assert "Ask a specialist job" in kept
    # The default budget keeps read_file unbounded (pinned), so workers are unchanged.
    assert maybe_persist_tool_result(huge, "read_file", "call-2", env=None) == huge


def test_coordinator_can_still_read_its_own_project_brain_whole():
    """A Project Brain runs ~15 KB; truncating it would corrupt the interview."""
    budget = coordinator_budget(DEFAULT_BUDGET)
    brain = "decision\n" * 1_800  # ~16 KB
    assert maybe_persist_tool_result(brain, "read_file", "brain", env=None, config=budget) == brain
    assert COORDINATOR_READ_FILE_CHARS > 16_500


def test_policy_marks_coordinator_and_enables_pruning():
    compressor = SimpleNamespace(
        context_length=128_000, proactive_prune_tokens=0, proactive_prune_min_result_chars=8000
    )
    agent = SimpleNamespace(context_compressor=compressor)

    assert apply_coordinator_context_policy(agent, COORDINATOR) is True
    assert agent._studio_coordinator is True
    assert compressor.proactive_prune_tokens == int(128_000 * 0.4)
    assert compressor.proactive_prune_min_result_chars == COORDINATOR_PRUNE_MIN_RESULT_CHARS


def test_policy_leaves_workers_and_missing_compressors_alone():
    compressor = SimpleNamespace(context_length=128_000, proactive_prune_tokens=0)
    worker = SimpleNamespace(context_compressor=compressor)

    assert apply_coordinator_context_policy(worker, WORKER) is False
    assert worker._studio_coordinator is False
    assert compressor.proactive_prune_tokens == 0

    bare = SimpleNamespace()
    assert apply_coordinator_context_policy(bare, COORDINATOR) is True
    assert bare._studio_coordinator is True


def test_unknown_context_length_falls_back_to_a_finite_prune_threshold():
    compressor = SimpleNamespace(context_length=None, proactive_prune_tokens=0)
    agent = SimpleNamespace(context_compressor=compressor)
    apply_coordinator_context_policy(agent, COORDINATOR)
    assert compressor.proactive_prune_tokens == 60_000
