"""Only finished phases and live decisions cost a coordinator turn."""

import pytest

from tui_gateway.notification_policy import job_notice_payload, notification_requires_turn


def _evt(**fields):
    return {"type": "kanban_task", "task_id": "t_1", "event_cursor": 7, **fields}


@pytest.mark.parametrize(
    ("event_kind", "task_status", "attention_kind", "expected"),
    [
        ("completed", "done", None, True),
        ("completed", "review", None, True),
        ("blocked", "blocked", "review", True),
        ("blocked", "blocked", "input", True),
        ("blocked", "blocked", None, True),
        ("block_loop_detected", "triage", None, True),
        ("gave_up", "triage", None, True),
        ("crashed", "ready", None, False),
        ("timed_out", "running", None, False),
        ("crashed", "blocked", None, False),
        ("blocked", "running", None, False),
        ("blocked", "done", None, False),
        ("gave_up", "running", None, False),
        ("", "running", None, False),
        ("", "done", None, True),
    ],
)
def test_turn_policy(event_kind, task_status, attention_kind, expected):
    evt = _evt(event_kind=event_kind, task_status=task_status)
    if attention_kind:
        evt["attention_kind"] = attention_kind
    assert notification_requires_turn(evt) is expected


def test_other_notification_types_keep_their_turn():
    assert notification_requires_turn({"type": "completion"}) is True
    assert notification_requires_turn({"type": "async_delegation"}) is True


def test_notice_payload_carries_identity_for_dedupe():
    payload = job_notice_payload(
        _evt(event_kind="timed_out", task_status="ready"), "Architecture attempt failed."
    )
    assert payload == {
        "kind": "project_job",
        "text": "Architecture attempt failed.",
        "task_id": "t_1",
        "event_kind": "timed_out",
        "event_cursor": 7,
        "task_status": "ready",
    }
