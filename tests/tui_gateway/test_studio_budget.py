"""The coordinator's context stays small; workers keep the normal tool budget."""

from types import SimpleNamespace

from agent.tool_executor import _budget_for_agent
from tools.budget_config import DEFAULT_BUDGET, BudgetConfig, budget_for_context_window
from tools.tool_result_storage import enforce_turn_budget, maybe_persist_tool_result
from tui_gateway.studio_budget import (
    COORDINATOR_INLINE_CAPS,
    COORDINATOR_COMPRESSION_CAP_TOKENS,
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


def test_project_brain_survives_both_budget_stages_in_one_turn():
    """Per-result cap admits the Brain; the aggregate stage must not shrink it after."""
    budget = coordinator_budget(DEFAULT_BUDGET)
    brain = "x" * 16_200
    reads = [
        {"role": "tool", "name": "read_file", "tool_call_id": "brain", "content": brain},
        *[
            {"role": "tool", "name": "web_extract", "tool_call_id": f"w{i}", "content": "y" * 6_000}
            for i in range(3)
        ],
    ]
    for message in reads:
        message["content"] = maybe_persist_tool_result(
            message["content"], message["name"], message["tool_call_id"], env=None, config=budget
        )

    enforce_turn_budget(reads, env=None, config=budget)

    assert reads[0]["content"] == brain
    assert sum(len(m["content"]) for m in reads[1:]) < 3 * 6_000


def _compressor(window=1_000_000, **kwargs):
    from agent.context_compressor import ContextCompressor
    return ContextCompressor(model="test-model", config_context_length=window, quiet_mode=True, **kwargs)


def test_compression_threshold_is_capped_and_survives_model_switch():
    compressor = _compressor()
    apply_coordinator_context_policy(SimpleNamespace(context_compressor=compressor), COORDINATOR)
    assert compressor.threshold_tokens == COORDINATOR_COMPRESSION_CAP_TOKENS
    assert compressor.tail_token_budget == int(compressor.threshold_tokens * compressor.summary_target_ratio)
    compressor.update_model("another-model", 2_000_000)
    assert compressor.threshold_tokens == COORDINATOR_COMPRESSION_CAP_TOKENS


def test_policy_preserves_cache_until_normal_compression_and_retains_history_on_failure():
    compressor = _compressor(128_000, proactive_prune_tokens=1)
    agent = SimpleNamespace(context_compressor=compressor)

    assert apply_coordinator_context_policy(agent, COORDINATOR) is True
    assert agent._studio_coordinator is True
    assert compressor.proactive_prune_tokens == 0
    assert compressor.abort_on_summary_failure is True
    history = [{"role": "tool", "content": "unique decision " * 2000}] * 40
    unchanged, pruned = compressor.prune_tool_results_only(history, current_tokens=120_000)
    assert unchanged is history and pruned == 0


def test_tighter_user_compression_cap_is_respected():
    compressor = _compressor(threshold_tokens_cap=40_000)
    apply_coordinator_context_policy(SimpleNamespace(context_compressor=compressor), COORDINATOR)
    assert compressor.threshold_tokens == 40_000


def test_policy_leaves_workers_and_missing_compressors_alone():
    compressor = SimpleNamespace(context_length=128_000, proactive_prune_tokens=0)
    worker = SimpleNamespace(context_compressor=compressor)

    assert apply_coordinator_context_policy(worker, WORKER) is False
    assert worker._studio_coordinator is False
    assert compressor.proactive_prune_tokens == 0

    bare = SimpleNamespace()
    assert apply_coordinator_context_policy(bare, COORDINATOR) is True
    assert bare._studio_coordinator is True


def test_external_context_engines_keep_their_own_policy():
    compressor = SimpleNamespace(context_length=None, proactive_prune_tokens=0)
    agent = SimpleNamespace(context_compressor=compressor)
    apply_coordinator_context_policy(agent, COORDINATOR)
    assert vars(compressor) == {"context_length": None, "proactive_prune_tokens": 0}
