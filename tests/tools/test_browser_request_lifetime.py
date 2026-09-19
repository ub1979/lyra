"""Real cleanup and AIAgent forwarding, with controlled clocks/transport."""

from types import SimpleNamespace
from unittest.mock import Mock

import pytest

from tools import browser_request_lifetime as lifetime


@pytest.fixture
def clock(monkeypatch):
    now = [1000.0]
    monkeypatch.setattr(lifetime.time, "monotonic", lambda: now[0])
    monkeypatch.setattr(lifetime, "_requests", {})
    monkeypatch.setattr(lifetime, "_released", {})
    return now


def owner(name="one", timeout=600):
    return SimpleNamespace(_current_task_id=name, _interrupt_requested=False,
                           _resolved_api_call_timeout=lambda: timeout)


def test_slow_request_preserves_only_its_browser_then_normal_idle_cleanup(clock, monkeypatch):
    from tools import browser_tool as browser

    monkeypatch.setattr(browser.time, "time", lambda: clock[0])
    monkeypatch.setattr(browser, "_session_last_activity", {"one": 1000, "one::local": 1000, "other": 1000})
    monkeypatch.setattr(browser, "BROWSER_SESSION_INACTIVITY_TIMEOUT", 120)
    cleanup = Mock()
    monkeypatch.setattr(browser, "cleanup_browser", cleanup)
    with lifetime.protect_browser_request(owner()):
        clock[0] += 136
        browser._cleanup_inactive_browser_sessions()
        assert [call.args[0] for call in cleanup.call_args_list] == ["other"]
    browser._cleanup_inactive_browser_sessions()
    assert cleanup.call_count == 1
    clock[0] += 121
    browser._cleanup_inactive_browser_sessions()
    assert {call.args[0] for call in cleanup.call_args_list} == {"one", "one::local", "other"}


def test_request_cancellation_and_deadline_do_not_protect_stuck_work(clock):
    agent = owner(timeout=200)
    with lifetime.protect_browser_request(agent):
        clock[0] += 201
        assert not lifetime.request_protects_browser("one", 120)
    clock[0] += 121
    with lifetime.protect_browser_request(agent):
        agent._interrupt_requested = True
        assert not lifetime.request_protects_browser("one", 120)
    assert not lifetime.request_protects_browser("one", 120)


def test_nested_owners_do_not_release_each_other(clock):
    with lifetime.protect_browser_request(owner()):
        with lifetime.protect_browser_request(owner()):
            clock[0] += 136
        clock[0] += 121
        assert lifetime.request_protects_browser("one", 120)
    clock[0] += 121
    assert not lifetime.request_protects_browser("one", 120)


@pytest.mark.parametrize("streaming", [False, True])
def test_actual_agent_forwarder_retains_browser_and_releases_on_error(clock, monkeypatch, streaming):
    from run_agent import AIAgent
    from agent import chat_completion_helpers as calls

    method = "_interruptible_streaming_api_call" if streaming else "_interruptible_api_call"
    def request(agent, kwargs, **options):
        clock[0] += 136
        assert lifetime.request_protects_browser("one", 120)
        raise RuntimeError("transport failed")
    monkeypatch.setattr(calls, method.removeprefix("_"), request)
    with pytest.raises(RuntimeError, match="transport failed"):
        getattr(AIAgent, method)(owner(), {})
    assert not lifetime._requests
    assert not lifetime.request_protects_browser("one", 120)


def test_daemon_crash_fallback_covers_configured_deadlines_and_stays_finite(monkeypatch):
    from hermes_cli import config

    monkeypatch.setattr(config, "load_config_readonly", lambda: {"providers": {
        "custom": {"request_timeout_seconds": 4200, "models": {
            "slow": {"timeout_seconds": 7200}, "bad": {"timeout_seconds": float("inf")},
        }},
    }})
    assert int(lifetime.daemon_idle_timeout_ms(120)) == 7320000
