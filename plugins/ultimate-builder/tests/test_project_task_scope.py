"""Project controls include real isolated descendants, never arbitrary dependencies."""

import importlib.util
from pathlib import Path

import pytest

from hermes_cli import kanban_db as kb


@pytest.fixture
def project(tmp_path, monkeypatch):
    monkeypatch.setenv("HERMES_HOME", str(tmp_path / "home"))
    monkeypatch.setenv("HERMES_KANBAN_HOME", str(tmp_path / "board"))
    monkeypatch.delenv("HERMES_KANBAN_TASK", raising=False)
    path = tmp_path / "project"
    path.mkdir()
    spec = importlib.util.spec_from_file_location(
        "scope_project_runs", Path(__file__).resolve().parents[1] / "project_runs.py",
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return path, module


def root(conn, project, title="QA"):
    return kb.create_task(conn, title=title, assignee="default",
                          workspace_kind="dir", workspace_path=str(project))


def child(conn, *parents, **kwargs):
    return kb.create_task(conn, title="repair", assignee="default", parents=parents, **kwargs)


def test_isolated_descendants_remain_visible_after_root_archive(project):
    path, runs = project
    with kb.connect_closing() as conn:
        qa = root(conn, path)
        repair = child(conn, qa)
        retest = child(conn, repair)
        kb.archive_task(conn, qa)
        # Materialization of the scratch directory must not detach ownership.
        with kb.write_txn(conn):
            conn.execute("UPDATE tasks SET workspace_path=? WHERE id=?",
                         (str(path.parent / "scratch"), repair))
    assert {task.id for _, task in runs._project_tasks(path)} == {qa, repair, retest}
    assert {task["task_id"] for task in runs.project_run_state(path)["tasks"]} == {qa, repair, retest}
    stopped = runs.control_project_run(path, "stop")
    assert stopped["ok"] and set(stopped["changed"]) == {repair, retest}
    with kb.connect_closing() as conn:
        kb.recompute_ready(conn)
        assert kb.claim_task(conn, repair) is None
        assert kb.claim_task(conn, retest) is None


def test_links_do_not_steal_shared_or_external_work(project):
    path, runs = project
    with kb.connect_closing() as conn:
        qa = root(conn, path)
        repair = child(conn, qa)
        other = root(conn, path.parent / "other", "Other project")
        external = child(conn, qa, workspace_kind="dir", workspace_path=str(path.parent / "elsewhere"))
        explicit_scratch = child(conn, qa, workspace_path=str(path.parent / "assigned-scratch"))
        shared = child(conn, qa, other)
        relinked = child(conn, qa)
        kb.link_tasks(conn, other, relinked)
        preexisting = child(conn)
        kb.link_tasks(conn, qa, preexisting)
        unaffected = {tid: kb.get_task(conn, tid) for tid in (
            other, external, explicit_scratch, shared, relinked, preexisting,
        )}
    assert {task.id for _, task in runs._project_tasks(path)} == {qa, repair}
    assert set(runs.control_project_run(path, "stop")["changed"]) == {qa, repair}
    with kb.connect_closing() as conn:
        for tid, before in unaffected.items():
            after = kb.get_task(conn, tid)
            assert after.status != "archived"
            assert after.workspace_path == before.workspace_path
            assert after.claim_lock == before.claim_lock


def test_pause_resume_and_relocate_preserve_scratch_isolation(project):
    path, runs = project
    scratch = path.parent / "scratch"
    with kb.connect_closing() as conn:
        qa = root(conn, path)
        repair = child(conn, qa)
        kb.archive_task(conn, qa)
        with kb.write_txn(conn):
            conn.execute("UPDATE tasks SET workspace_path=? WHERE id=?", (str(scratch), repair))
    assert runs.control_project_run(path, "pause")["changed"] == [repair]
    assert runs.control_project_run(path, "resume")["changed"] == [repair]
    destination = path.parent / "moved"
    path.rename(destination)
    assert set(runs.relocate_project_runs(path, destination)["changed"]) == {qa, repair}
    with kb.connect_closing() as conn:
        assert kb.get_task(conn, qa).workspace_path == str(destination)
        assert kb.get_task(conn, repair).workspace_path == str(scratch)
    assert {task.id for _, task in runs._project_tasks(destination)} == {qa, repair}


def test_other_board_is_not_touched(project):
    path, runs = project
    with kb.connect_closing() as conn:
        qa = root(conn, path)
    kb.create_board("other")
    with kb.connect_closing(board="other") as conn:
        unrelated = root(conn, path.parent / "other-project")
    assert runs.control_project_run(path, "stop")["changed"] == [qa]
    with kb.connect_closing(board="other") as conn:
        assert kb.get_task(conn, unrelated).status == "ready"


def test_linked_project_worktree_keeps_isolation_and_correct_membership(project):
    from hermes_cli import projects_db as pdb

    path, runs = project
    with pdb.connect_closing() as conn:
        pid = pdb.create_project(conn, name="Owned", folders=[str(path)])
        other_pid = pdb.create_project(conn, name="Other", folders=[str(path.parent / "other")])
    with kb.connect_closing() as conn:
        qa = kb.create_task(conn, title="QA", assignee="default", workspace_kind="dir",
                            workspace_path=str(path), project_id=pid)
        repair = child(conn, qa, project_id=pid)
        other = child(conn, qa, project_id=other_pid)
        original = kb.get_task(conn, repair)
        assert original.workspace_kind == "worktree"
    assert {task.id for _, task in runs._project_tasks(path)} == {qa, repair}
    assert set(runs.control_project_run(path, "stop")["changed"]) == {qa, repair}
    with kb.connect_closing() as conn:
        assert kb.get_task(conn, repair).workspace_path == original.workspace_path
        assert kb.get_task(conn, other).status != "archived"
