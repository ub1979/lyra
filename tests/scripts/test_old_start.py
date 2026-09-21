from __future__ import annotations

import os
from pathlib import Path
import subprocess


ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "old_start.sh"


def _run(*args: str, env: dict[str, str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["bash", str(SCRIPT), *args],
        cwd=ROOT,
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )


def test_old_start_runs_comparison_branch_on_separate_default_port(tmp_path: Path) -> None:
    checkout = tmp_path / "comparison checkout"
    checkout.mkdir()
    subprocess.run(["git", "init", "-q", "-b", "codex/aug28-ui-brain"], cwd=checkout, check=True)

    launcher = checkout / "start.sh"
    launcher.write_text(
        "#!/usr/bin/env bash\n"
        "printf 'port=%s\\n' \"$LYRA_PORT\"\n"
        "printf 'args=%s\\n' \"$*\"\n"
    )
    launcher.chmod(0o755)

    env = os.environ.copy()
    env["LYRA_OLD_DIR"] = str(checkout)
    env.pop("LYRA_OLD_PORT", None)
    env["LYRA_PORT"] = "9999"

    result = _run("--no-open", env=env)

    assert result.returncode == 0, result.stderr
    assert "port=9120" in result.stdout
    assert "args=--no-open" in result.stdout


def test_old_start_honours_old_port_override(tmp_path: Path) -> None:
    checkout = tmp_path / "comparison"
    checkout.mkdir()
    subprocess.run(["git", "init", "-q", "-b", "codex/aug28-ui-brain"], cwd=checkout, check=True)
    launcher = checkout / "start.sh"
    launcher.write_text("#!/usr/bin/env bash\nprintf '%s\\n' \"$LYRA_PORT\"\n")
    launcher.chmod(0o755)

    env = os.environ.copy()
    env["LYRA_OLD_DIR"] = str(checkout)
    env["LYRA_OLD_PORT"] = "9130"

    result = _run(env=env)

    assert result.returncode == 0, result.stderr
    assert result.stdout.rstrip().endswith("9130")


def test_old_start_refuses_a_different_branch(tmp_path: Path) -> None:
    checkout = tmp_path / "wrong"
    checkout.mkdir()
    subprocess.run(["git", "init", "-q", "-b", "main"], cwd=checkout, check=True)
    launcher = checkout / "start.sh"
    launcher.write_text("#!/usr/bin/env bash\nexit 99\n")
    launcher.chmod(0o755)

    env = os.environ.copy()
    env["LYRA_OLD_DIR"] = str(checkout)

    result = _run(env=env)

    assert result.returncode == 1
    assert "Refusing to start the wrong Lyra version" in result.stdout
