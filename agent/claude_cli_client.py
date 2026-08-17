"""Claude Code CLI transport for Hermes external-agent turns.

This deliberately invokes the user's installed ``claude`` executable instead
of reading its OAuth token and replaying it against the Anthropic API.  The
child receives a credential-stripped environment, so an ambient
``ANTHROPIC_API_KEY`` cannot silently switch a subscription run to API billing.
Claude's built-in tools, settings, MCP servers, skills, and session persistence
are disabled: Hermes remains the sole tool/permission loop.
"""

from __future__ import annotations

import json
import os
import subprocess
import threading
from collections import deque
from typing import Any

from agent.copilot_acp_client import CopilotACPClient
from tools.environments.local import hermes_subprocess_env


CLAUDE_CLI_MARKER_BASE_URL = "claude-cli://local"
_DEFAULT_TIMEOUT_SECONDS = 600.0
_MAX_OUTPUT_BYTES = 16 * 1024 * 1024


def _normalize_cli_model(model: str | None) -> str:
    value = str(model or "").strip()
    if not value or value in {"claude-cli", "default"}:
        return ""
    for prefix in ("claude-cli/", "anthropic/"):
        if value.lower().startswith(prefix):
            value = value[len(prefix) :]
            break
    return value


def _claude_subprocess_env() -> dict[str, str]:
    # Subscription auth lives in Claude's own credential store under HOME. Do
    # not inherit provider keys: Claude Code gives ANTHROPIC_API_KEY precedence
    # and would otherwise change the user's billing route without warning.
    env = hermes_subprocess_env(inherit_credentials=False)
    env.pop("ANTHROPIC_API_KEY", None)
    env.pop("ANTHROPIC_TOKEN", None)
    env.pop("ANTHROPIC_AUTH_TOKEN", None)
    env.pop("ANTHROPIC_BASE_URL", None)
    # CLAUDE_CODE_OAUTH_TOKEN is intentionally preserved. It is a Claude-owned
    # subscription credential used by some CLI installs, not a billable API key.
    env.pop("CLAUDECODE", None)
    return env


def _usage_from_payload(payload: Any) -> dict[str, int] | None:
    """Map Claude CLI ``--output-format json`` usage into OpenAI-compatible keys.

    The CLI reports input in three separate buckets — fresh, cache-read, and
    cache-creation — and all three are real prompt tokens the request carried,
    so ``prompt_tokens`` is their sum. ``cached_tokens`` keeps the cache-read
    share visible, which is the number that tells you whether prompt caching
    is actually working.
    """
    if not isinstance(payload, dict):
        return None
    usage = payload.get("usage")
    if not isinstance(usage, dict):
        return None

    def _int(key: str) -> int:
        try:
            return max(0, int(usage.get(key) or 0))
        except (TypeError, ValueError):
            return 0

    fresh = _int("input_tokens")
    cache_read = _int("cache_read_input_tokens")
    cache_creation = _int("cache_creation_input_tokens")
    completion = _int("output_tokens")
    prompt = fresh + cache_read + cache_creation
    if not (prompt or completion):
        return None
    return {
        "prompt_tokens": prompt,
        "completion_tokens": completion,
        "total_tokens": prompt + completion,
        "cached_tokens": cache_read,
    }


class ClaudeCLIClient(CopilotACPClient):
    """OpenAI-compatible facade backed by one isolated ``claude -p`` call."""

    def __init__(
        self,
        *,
        api_key: str | None = None,
        base_url: str | None = None,
        command: str | None = None,
        args: list[str] | None = None,
        acp_command: str | None = None,
        acp_args: list[str] | None = None,
        **kwargs: Any,
    ) -> None:
        super().__init__(
            api_key=api_key or "claude-cli",
            base_url=base_url or CLAUDE_CLI_MARKER_BASE_URL,
            command=command or acp_command or "claude",
            args=list(args if args is not None else (acp_args or [])),
            **kwargs,
        )
        self.api_key = api_key or "claude-cli"
        self.base_url = base_url or CLAUDE_CLI_MARKER_BASE_URL
        self._request_context = threading.local()

    def _create_chat_completion(self, **kwargs: Any) -> Any:
        self._request_context.model = kwargs.get("model")
        try:
            return super()._create_chat_completion(**kwargs)
        finally:
            self._request_context.model = None

    def _run_prompt(self, prompt_text: str, *, timeout_seconds: float) -> tuple[str, str]:
        model = _normalize_cli_model(getattr(self._request_context, "model", None))
        effective_timeout = timeout_seconds if timeout_seconds > 0 else _DEFAULT_TIMEOUT_SECONDS

        command = [
            self._acp_command,
            *self._acp_args,
            "--print",
            "--output-format",
            "json",
            "--no-session-persistence",
            "--safe-mode",
            "--permission-mode",
            "dontAsk",
            "--tools",
            "",
            "--strict-mcp-config",
            "--setting-sources=",
        ]
        if model:
            command.extend(["--model", model])

        from hermes_cli._subprocess_compat import windows_hide_flags

        try:
            proc = subprocess.Popen(
                command,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                encoding="utf-8",
                errors="replace",
                cwd=self._acp_cwd,
                env=_claude_subprocess_env(),
                creationflags=windows_hide_flags(),
                start_new_session=os.name != "nt",
            )
        except FileNotFoundError as exc:
            raise RuntimeError(
                f"Could not start Claude CLI command '{self._acp_command}'. "
                "Install Claude Code and run `claude auth login`, or configure "
                "providers.claude-cli.command in config.yaml."
            ) from exc

        self.is_closed = False
        with self._active_process_lock:
            self._active_process = proc

        try:
            stdout, stderr = proc.communicate(input=prompt_text, timeout=effective_timeout)
        except subprocess.TimeoutExpired as exc:
            proc.kill()
            stdout, stderr = proc.communicate()
            raise TimeoutError(
                f"Claude CLI did not finish within {effective_timeout:.0f} seconds."
            ) from exc
        finally:
            with self._active_process_lock:
                if self._active_process is proc:
                    self._active_process = None

        stdout = stdout or ""
        stderr_tail = deque((stderr or "").splitlines(), maxlen=40)
        if len(stdout.encode("utf-8")) > _MAX_OUTPUT_BYTES:
            raise RuntimeError("Claude CLI output exceeded the 16 MiB safety limit.")

        try:
            payload = json.loads(stdout)
        except json.JSONDecodeError as exc:
            detail = "\n".join(stderr_tail).strip() or stdout[-1000:].strip()
            raise RuntimeError(
                f"Claude CLI returned invalid JSON{f': {detail}' if detail else '.'}"
            ) from exc

        result = payload.get("result") if isinstance(payload, dict) else None
        error_text = ""
        if isinstance(payload, dict):
            error_text = str(payload.get("error") or payload.get("message") or "").strip()
        if proc.returncode != 0 or (isinstance(payload, dict) and payload.get("is_error")):
            detail = error_text or "\n".join(stderr_tail).strip() or "unknown Claude CLI error"
            raise RuntimeError(f"Claude CLI failed (exit {proc.returncode}): {detail}")
        if not isinstance(result, str):
            raise RuntimeError("Claude CLI response did not contain a text result.")
        self.record_prompt_usage(_usage_from_payload(payload))
        return result, ""
