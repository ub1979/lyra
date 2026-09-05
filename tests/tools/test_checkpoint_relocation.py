"""Real Git snapshot/move/restore tests, isolated from the user's store."""

import pytest

from tools import checkpoint_manager as cp


def test_move_preserves_history_and_restores_at_new_path(tmp_path, monkeypatch):
    monkeypatch.setattr(cp, "CHECKPOINT_BASE", tmp_path / "store")
    project = tmp_path / "before"
    project.mkdir()
    (project / "note.txt").write_text("original")
    manager = cp.CheckpointManager(enabled=True)
    assert manager.ensure_checkpoint(str(project))
    before = manager.list_checkpoints(str(project))
    moved = tmp_path / "after"
    project.rename(moved)
    assert manager.relocate_project(str(project), str(moved))
    assert manager.relocate_project(str(project), str(moved))  # retry is harmless
    assert manager.list_checkpoints(str(moved))[0]["hash"] == before[0]["hash"]
    (moved / "note.txt").write_text("new")
    manager.new_turn()
    assert manager.ensure_checkpoint(str(moved))
    assert len(manager.list_checkpoints(str(moved))) == 2
    restored = manager.restore(str(moved), before[0]["hash"])
    assert restored.get("success"), restored
    assert (moved / "note.txt").read_text() == "original"
    assert not project.exists()


def test_move_never_overwrites_destination_history(tmp_path, monkeypatch):
    monkeypatch.setattr(cp, "CHECKPOINT_BASE", tmp_path / "store")
    source, destination = tmp_path / "a", tmp_path / "b"
    manager = cp.CheckpointManager(enabled=True)
    for project, content in ((source, "a"), (destination, "b")):
        project.mkdir()
        (project / "note.txt").write_text(content)
        assert manager.ensure_checkpoint(str(project))
    before = manager.list_checkpoints(str(destination))
    with pytest.raises(ValueError, match="different recovery history"):
        manager.relocate_project(str(source), str(destination))
    assert manager.list_checkpoints(str(destination)) == before
