"""Power protection owns only active model requests, never an idle conversation."""

from types import SimpleNamespace
from unittest.mock import Mock

import pytest

from agent import request_power as power


def owner(studio=True):
    return SimpleNamespace(_studio_coordinator=studio,
                           _resolved_api_call_timeout=lambda: 600)


@pytest.fixture
def os_boundary(monkeypatch):
    process = Mock()
    process.poll.return_value = None
    spawn = Mock(return_value=process)
    # Replace only this module's OS boundary, not global subprocess imports used
    # by provider/tool discovery while the real AIAgent forwarder is imported.
    monkeypatch.setattr(power, "sys", SimpleNamespace(platform="darwin"))
    monkeypatch.setattr(power, "os", SimpleNamespace(
        getpid=power.os.getpid,
        path=SimpleNamespace(isfile=lambda path: path == "/usr/bin/caffeinate"),
    ))
    monkeypatch.setattr(power, "subprocess", SimpleNamespace(
        Popen=spawn, DEVNULL=power.subprocess.DEVNULL,
        TimeoutExpired=power.subprocess.TimeoutExpired,
    ))
    return spawn, process


@pytest.mark.parametrize("error", [False, True])
def test_request_bound_allows_display_sleep_and_always_releases(os_boundary, error):
    spawn, process = os_boundary
    try:
        with power.protect_studio_request(owner()):
            command = spawn.call_args.args[0]
            assert command == ["/usr/bin/caffeinate", "-i", "-w", str(power.os.getpid()), "-t", "600"]
            process.terminate.assert_not_called()
            if error:
                raise RuntimeError("provider failed")
    except RuntimeError:
        assert error
    process.terminate.assert_called_once()
    process.wait.assert_called_once_with(timeout=1)


@pytest.mark.parametrize("platform,studio", [("linux", True), ("win32", True), ("darwin", False)])
def test_other_platforms_and_noncoordinators_unchanged(os_boundary, monkeypatch, platform, studio):
    monkeypatch.setattr(power.sys, "platform", platform)
    with power.protect_studio_request(owner(studio)):
        pass
    os_boundary[0].assert_not_called()


def test_missing_os_capability_does_not_break_inference(os_boundary):
    os_boundary[0].side_effect = OSError("helper unavailable")
    with power.protect_studio_request(owner()):
        pass


def test_unresponsive_helper_cleanup_is_bounded(os_boundary):
    spawn, process = os_boundary
    process.wait.side_effect = [power.subprocess.TimeoutExpired("caffeinate", 1), None]
    with power.protect_studio_request(owner()):
        pass
    process.kill.assert_called_once()
    assert process.wait.call_count == 2


@pytest.mark.parametrize("streaming", [False, True])
def test_actual_agent_forwarder_releases_before_return_to_user(os_boundary, monkeypatch, streaming):
    from run_agent import AIAgent
    from agent import chat_completion_helpers as calls

    method = "_interruptible_streaming_api_call" if streaming else "_interruptible_api_call"
    def request(agent, kwargs, **options):
        os_boundary[0].assert_called_once()
        os_boundary[1].terminate.assert_not_called()
        return {"answer": "ready for a user choice"}
    monkeypatch.setattr(calls, method.removeprefix("_"), request)
    assert getattr(AIAgent, method)(owner(), {})["answer"] == "ready for a user choice"
    os_boundary[1].terminate.assert_called_once()
