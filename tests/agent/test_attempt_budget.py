"""Unit rules for the attempt-wide call budget (see agent/attempt_budget.py)."""

from types import SimpleNamespace

from agent.attempt_budget import attempt_limit, turn_call_limit
from agent.iteration_budget import IterationBudget

WORKER = {"HERMES_KANBAN_TASK": "t_1", "HERMES_KANBAN_ATTEMPT_MAX_CALLS": "10"}


def _spend(budget, calls):
    for _ in range(calls):
        assert budget.consume()


def test_limit_applies_only_to_kanban_workers_with_a_valid_value():
    assert attempt_limit(WORKER) == 10
    assert attempt_limit({"HERMES_KANBAN_ATTEMPT_MAX_CALLS": "10"}) is None
    assert attempt_limit({**WORKER, "HERMES_KANBAN_ATTEMPT_MAX_CALLS": "0"}) is None
    assert attempt_limit({**WORKER, "HERMES_KANBAN_ATTEMPT_MAX_CALLS": "many"}) is None


def test_without_a_limit_every_turn_gets_the_full_per_turn_budget():
    agent = SimpleNamespace(max_iterations=90, iteration_budget=IterationBudget(90))
    _spend(agent.iteration_budget, 40)

    assert turn_call_limit(agent, {}) == 90


def test_spent_calls_carry_across_turns_and_are_counted_once():
    agent = SimpleNamespace(max_iterations=10, iteration_budget=IterationBudget(10))
    agent.iteration_budget = IterationBudget(turn_call_limit(agent, WORKER))
    _spend(agent.iteration_budget, 6)

    agent.iteration_budget = IterationBudget(turn_call_limit(agent, WORKER))
    assert agent.iteration_budget.remaining == 4
    # Asking again without spending must not count the same calls twice.
    assert turn_call_limit(agent, WORKER) == 4


def test_an_exhausted_attempt_gives_the_next_turn_no_calls():
    agent = SimpleNamespace(max_iterations=10, iteration_budget=IterationBudget(10))
    _spend(agent.iteration_budget, 10)

    assert turn_call_limit(agent, WORKER) == 0
