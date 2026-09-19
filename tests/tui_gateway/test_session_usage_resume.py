"""Actual SQLite close/reopen, gateway serialization, and constructor wiring."""
from types import SimpleNamespace
from unittest.mock import Mock
from contextlib import closing

from hermes_state import SessionDB
from tui_gateway.session_usage import saved_usage_baseline
from tui_gateway import server


def agent_for(db, sid):
    agent = SimpleNamespace(session_id=sid, model="test", context_compressor=None)
    agent._gateway_usage_baseline = saved_usage_baseline(db, sid)
    return agent


def record_call(db, agent, amount=10):
    # These are the same delta semantics as the real model loop, deliberately
    # updating both runtime and persistence before a UI event is serialized.
    for name, value in {
        "input_tokens": amount, "output_tokens": 2, "cache_read_tokens": 3,
        "cache_write_tokens": 1, "reasoning_tokens": 1, "prompt_tokens": amount + 4,
        "completion_tokens": 2, "total_tokens": amount + 6, "api_calls": 1,
    }.items():
        attr = "session_" + name
        setattr(agent, attr, getattr(agent, attr, 0) + value)
    db.update_token_counts(agent.session_id, input_tokens=amount, output_tokens=2,
                           cache_read_tokens=3, cache_write_tokens=1,
                           reasoning_tokens=1, api_call_count=1)


def test_cold_resume_next_turn_and_reconnect_never_double_count(tmp_path):
    path = tmp_path / "state.db"
    db = SessionDB(db_path=path)
    db.create_session("chat", source="tui", model="test")
    agent = agent_for(db, "chat")
    record_call(db, agent)
    assert server._get_usage(agent)["total"] == 16
    db.close()
    db = SessionDB(db_path=path)
    try:
        resumed = agent_for(db, "chat")
        session = {"agent": resumed}
        assert server._session_usage_snapshot(session)["total"] == 16
        record_call(db, resumed, 20)
        for _ in range(3):
            usage = server._session_usage_snapshot(session)
            assert usage["total"] == 42
            assert usage["calls"] == 2
            assert usage["reasoning"] == 2
        assert db.get_session("chat")["input_tokens"] == 30
        assert resumed.session_input_tokens == 20  # display never rewrites billing.
        assert server._get_usage(agent_for(db, "other"))["total"] == 0
    finally:
        db.close()


def test_compression_ancestors_included_but_workers_and_branches_not(tmp_path):
    with closing(SessionDB(db_path=tmp_path / "state.db")) as db:
        db.create_session("root", source="tui", model="test")
        db.update_token_counts("root", input_tokens=100, api_call_count=1)
        db.create_session("worker", source="tui", model="test", parent_session_id="root",
                          model_config={"_delegate_from": "root"})
        db.update_token_counts("worker", input_tokens=900, api_call_count=9)
        db.create_session("branch", source="tui", parent_session_id="root",
                          model_config={"_branched_from": "root"})
        db.update_token_counts("branch", input_tokens=800)
        db.create_session("tool-child", source="tool", parent_session_id="root")
        db.update_token_counts("tool-child", input_tokens=700)
        assert db.try_acquire_compression_lock("root", "test", ttl_seconds=60)
        db.publish_compression_child(parent_session_id="root", child_session_id="tip",
                                     source="tui", messages=[{"role": "user", "content": "summary"}],
                                     compression_lock_holder="test")
        db.update_token_counts("tip", input_tokens=20, api_call_count=1)
        assert db.get_compression_lineage("root") == ["root", "tip"]
        assert server._get_usage(agent_for(db, "tip"))["input"] == 120
        assert server._get_usage(agent_for(db, "worker"))["input"] == 900
        assert server._get_usage(agent_for(db, "branch"))["input"] == 800
        assert server._get_usage(agent_for(db, "tool-child"))["input"] == 700


def test_live_compression_keeps_the_same_baseline_until_a_new_agent(tmp_path):
    with closing(SessionDB(db_path=tmp_path / "state.db")) as db:
        db.create_session("root", source="tui")
        db.update_token_counts("root", input_tokens=100)
        agent = agent_for(db, "root")
        record_call(db, agent)
        db.end_session("root", "compression")
        db.create_session("tip", source="tui", parent_session_id="root")
        agent.session_id = "tip"
        record_call(db, agent, 20)
        assert server._get_usage(agent)["total"] == 142
        assert server._get_usage(agent_for(db, "tip"))["total"] == 142


def test_unknown_persistence_does_not_claim_zero_or_partial_total():
    db = Mock()
    db.get_compression_lineage.side_effect = OSError("unavailable")
    agent = agent_for(db, "saved-chat")
    agent.session_input_tokens = 20
    usage = server._get_usage(agent)
    assert "total" not in usage and "input" not in usage and "calls" not in usage
    assert usage["usage_status"] == "unavailable"


def test_lifetime_does_not_become_context_occupancy(tmp_path):
    with closing(SessionDB(db_path=tmp_path / "state.db")) as db:
        db.create_session("chat", source="tui", model="test")
        db.update_token_counts("chat", input_tokens=200000)
        agent = agent_for(db, "chat")
        agent.context_compressor = SimpleNamespace(last_prompt_tokens=500, context_length=10000)
        usage = server._get_usage(agent)
        assert usage["total"] == 200000
        assert usage["context_used"] == 500 and usage["context_percent"] == 5


def test_make_agent_captures_real_saved_baseline(tmp_path, monkeypatch):
    import run_agent

    def construct(**kwargs):
        return SimpleNamespace(session_id=kwargs["session_id"], model="test")

    monkeypatch.setattr(run_agent, "AIAgent", construct)
    monkeypatch.setattr(server, "_load_cfg", lambda: {})
    monkeypatch.setattr(server, "_resolve_startup_runtime", lambda: ("test", "custom"))
    monkeypatch.setattr(server, "_resolve_runtime_with_fallback", lambda args: SimpleNamespace(
        runtime={"provider": "custom", "base_url": "http://127.0.0.1:1/v1", "api_key": "test"},
        used_fallback=False,
    ))
    with closing(SessionDB(db_path=tmp_path / "state.db")) as db:
        db.create_session("chat", source="tui", model="test")
        db.update_token_counts("chat", input_tokens=321, api_call_count=1)
        agent = server._make_agent("view", "chat", session_db=db)
        assert server._get_usage(agent)["input"] == 321
