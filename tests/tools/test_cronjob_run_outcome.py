"""Immediate-run outcome survives removal of the finite schedule record."""

import pytest

from cron import executions, jobs, scheduler
from tools.cronjob_tools import _execute_job_now


@pytest.fixture
def cron_home(tmp_path, monkeypatch):
    home = tmp_path / "home"
    (home / "scripts").mkdir(parents=True)
    monkeypatch.setenv("HERMES_HOME", str(home))
    for key, path in {
        "HERMES_DIR": home, "CRON_DIR": home / "cron",
        "JOBS_FILE": home / "cron" / "jobs.json", "OUTPUT_DIR": home / "cron" / "output",
    }.items():
        monkeypatch.setattr(jobs, key, path)
    monkeypatch.setattr(executions, "EXECUTIONS_FILE", home / "cron" / "executions.db")
    # Delivery is not under test; actual script execution and both stores are.
    monkeypatch.setattr(scheduler, "_deliver_result", lambda *a, **kw: None)
    return home


@pytest.mark.parametrize("exit_code", [0, 7])
@pytest.mark.parametrize("schedule", ["1h", "every 1h"])
def test_real_script_attempt_reports_its_own_result(cron_home, exit_code, schedule):
    script = cron_home / "scripts" / "check.py"
    script.write_text(f"print('checked')\nraise SystemExit({exit_code})\n", encoding="utf-8")
    job = jobs.create_job(prompt="", schedule=schedule, script="check.py", no_agent=True)
    result = _execute_job_now(job)
    assert result["claimed"] is True
    assert result["success"] is (exit_code == 0)
    record = executions.latest_execution(job["id"])
    assert record["status"] == ("completed" if exit_code == 0 else "failed")
    if schedule == "1h":
        assert jobs.get_job(job["id"]) is None
    else:
        assert jobs.get_job(job["id"]) is not None


def test_lost_claim_creates_no_execution(cron_home):
    job = jobs.create_job(prompt="do not run", schedule="every 1h")
    assert jobs.claim_job_for_fire(job["id"])
    result = _execute_job_now(job)
    assert result["claimed"] is False
    assert executions.list_executions(job_id=job["id"]) == []
