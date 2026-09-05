"""Controlled AI-work boundary for the real Lyra dispatcher integration test."""

from __future__ import annotations

import os
from pathlib import Path
import subprocess
import time

from hermes_cli import kanban_db as kb


def main() -> None:
    workspace = Path(os.environ["HERMES_KANBAN_WORKSPACE"]).resolve()
    assert Path.cwd() == workspace
    assert Path(os.environ["TERMINAL_CWD"]) == workspace
    task_id = os.environ["HERMES_KANBAN_TASK"]
    run_id = int(os.environ["HERMES_KANBAN_RUN_ID"])
    with kb.connect_closing() as conn:
        task = kb.get_task(conn, task_id)
        assert task.claim_lock == os.environ["HERMES_KANBAN_CLAIM_LOCK"]
        assert kb.heartbeat_worker(conn, task_id, expected_run_id=run_id)

    # A bounded file barrier lets the parent observe real running/heartbeat
    # state before the child completes; no arbitrary long timing sleep.
    (workspace / "worker-started").touch()
    deadline = time.monotonic() + 20
    while not (workspace / "allow-completion").exists():
        if time.monotonic() >= deadline:
            raise TimeoutError("Integration test did not release worker")
        time.sleep(0.02)

    (workspace / "research-report.md").write_text(
        "# Controlled test evidence\nThe isolated worker completed its test.\n",
        encoding="utf-8",
    )
    for args in (
        ["init", "--quiet"],
        ["add", "research-report.md"],
        [
            "-c",
            "user.name=Lyra test",
            "-c",
            "user.email=test@example.invalid",
            "-c",
            "commit.gpgsign=false",
            "commit",
            "--quiet",
            "-m",
            "Test evidence",
        ],
    ):
        subprocess.run(["git", *args], cwd=workspace, check=True, timeout=10)
    with kb.connect_closing() as conn:
        assert kb.complete_task(
            conn,
            task_id,
            result="Controlled research evidence committed locally",
            expected_run_id=run_id,
        )


if __name__ == "__main__":
    main()
