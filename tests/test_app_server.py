from __future__ import annotations

import asyncio
import json
import logging
import queue
import subprocess
import threading
from typing import Any

import pytest

from geocopilot.app_server import AppServerError, CodexAppServer
from geocopilot.config import BUNDLED_SKILL_NAMES, AgentSettings, SettingsStore


class QueuedStream:
    def __init__(self) -> None:
        self._lines: queue.Queue[bytes] = queue.Queue()

    def readline(self) -> bytes:
        return self._lines.get()

    def feed_json(self, message: dict[str, Any]) -> None:
        self._lines.put((json.dumps(message) + "\n").encode())

    def close(self) -> None:
        self._lines.put(b"")


class FakeStdin:
    def __init__(self, process: FakeProcess) -> None:
        self.process = process
        self.writes: list[dict[str, Any]] = []

    def write(self, data: bytes) -> int:
        message = json.loads(data)
        self.writes.append(message)
        request_id = message.get("id")
        if message.get("method") == "initialize":
            self.process.stdout.feed_json({"id": request_id, "result": {}})
        elif message.get("method") == "skills/list":
            self.process.stdout.feed_json(
                {
                    "id": request_id,
                    "result": {
                        "data": [
                            {
                                "skills": [
                                    {"name": name, "enabled": True}
                                    for name in BUNDLED_SKILL_NAMES
                                ]
                            }
                        ]
                    },
                }
            )
        return len(data)

    def flush(self) -> None:
        return None


class FakeProcess:
    def __init__(self) -> None:
        self.stdout = QueuedStream()
        self.stderr = QueuedStream()
        self.stdin = FakeStdin(self)
        self.returncode: int | None = None
        self._exited = threading.Event()

    def poll(self) -> int | None:
        return self.returncode

    def wait(self, timeout: float | None = None) -> int:
        if not self._exited.wait(timeout):
            raise subprocess.TimeoutExpired("codex", timeout)
        assert self.returncode is not None
        return self.returncode

    def terminate(self) -> None:
        self._finish(-15)

    def kill(self) -> None:
        self._finish(-9)

    def _finish(self, returncode: int) -> None:
        self.returncode = returncode
        self._exited.set()
        self.stdout.close()
        self.stderr.close()


class AsyncFakeStdin:
    def __init__(self, process: AsyncFakeProcess) -> None:
        self.process = process
        self.writes: list[dict[str, Any]] = []

    def write(self, data: bytes) -> None:
        message = json.loads(data)
        self.writes.append(message)
        request_id = message.get("id")
        if message.get("method") == "initialize":
            response = json.dumps({"id": request_id, "result": {}}).encode() + b"\n"
            self.process.stdout.feed_data(response)
        elif message.get("method") == "skills/list":
            self.process.stdout.feed_data(
                (
                    json.dumps(
                        {
                            "id": request_id,
                            "result": {
                                "data": [
                                    {
                                        "skills": [
                                            {"name": name, "enabled": True}
                                            for name in BUNDLED_SKILL_NAMES
                                        ]
                                    }
                                ]
                            },
                        }
                    )
                    + "\n"
                ).encode()
            )

    async def drain(self) -> None:
        return None


class AsyncFakeProcess:
    def __init__(self) -> None:
        self.stdout = asyncio.StreamReader()
        self.stderr = asyncio.StreamReader()
        self.stdin = AsyncFakeStdin(self)
        self.returncode: int | None = None
        self._done: asyncio.Future[int] = asyncio.get_running_loop().create_future()

    async def wait(self) -> int:
        return await self._done

    def terminate(self) -> None:
        self._finish(-15)

    def kill(self) -> None:
        self._finish(-9)

    def _finish(self, returncode: int) -> None:
        self.returncode = returncode
        self.stdout.feed_eof()
        self.stderr.feed_eof()
        if not self._done.done():
            self._done.set_result(returncode)


def server_for(tmp_path, notifications: list[dict[str, Any]]) -> CodexAppServer:
    async def on_notification(message: dict[str, Any]) -> None:
        notifications.append(message)

    async def on_exit(_reason: str) -> None:
        return None

    return CodexAppServer(
        tmp_path,
        SettingsStore(tmp_path / "config", tmp_path / "data"),
        on_notification,
        on_exit,
        logging.getLogger("test"),
    )


@pytest.mark.asyncio
async def test_uses_popen_and_threads_without_asyncio_subprocess(tmp_path, monkeypatch):
    notifications: list[dict[str, Any]] = []
    server = server_for(tmp_path, notifications)
    server._windows = True
    process = FakeProcess()
    popen_calls: list[tuple[list[str], dict[str, Any]]] = []

    def fake_popen(args: list[str], **kwargs: Any) -> FakeProcess:
        popen_calls.append((args, kwargs))
        return process

    async def unexpected_asyncio_subprocess(*_args: Any, **_kwargs: Any) -> None:
        raise AssertionError("asyncio subprocesses are not Windows-compatible in Jupyter")

    monkeypatch.setattr("geocopilot.app_server.shutil.which", lambda _name: "codex")
    monkeypatch.setattr("geocopilot.app_server.subprocess.Popen", fake_popen)
    monkeypatch.setattr(asyncio, "create_subprocess_exec", unexpected_asyncio_subprocess)

    await server.start(AgentSettings(api_key="test-key"))

    assert popen_calls[0][0] == ["codex", "app-server", "--listen", "stdio://"]
    assert server.healthy is True
    assert [message["method"] for message in process.stdin.writes] == [
        "initialize",
        "initialized",
        "skills/list",
    ]

    process.stdout.feed_json(
        {
            "method": "item/completed",
            "params": {"item": {"id": "large-item", "aggregatedOutput": "x" * (200 * 1024)}},
        }
    )
    process.stdout.feed_json(
        {
            "method": "item/agentMessage/delta",
            "params": {"turnId": "turn-1", "delta": "Hello"},
        }
    )
    process.stdout.feed_json(
        {
            "method": "turn/completed",
            "params": {"turn": {"id": "turn-1", "status": "completed"}},
        }
    )
    for _ in range(50):
        if len(notifications) == 3:
            break
        await asyncio.sleep(0.01)
    assert notifications[0]["params"]["item"]["id"] == "large-item"
    assert [message["method"] for message in notifications] == [
        "item/completed",
        "item/agentMessage/delta",
        "turn/completed",
    ]

    await server.stop()
    assert process.returncode == -15


@pytest.mark.asyncio
async def test_non_windows_keeps_asyncio_subprocess_transport(tmp_path, monkeypatch):
    server = server_for(tmp_path, [])
    server._windows = False
    process = AsyncFakeProcess()

    async def fake_asyncio_subprocess(*args: Any, **kwargs: Any) -> AsyncFakeProcess:
        assert args == ("codex", "app-server", "--listen", "stdio://")
        assert kwargs["limit"] > 200 * 1024
        return process

    def unexpected_popen(*_args: Any, **_kwargs: Any) -> None:
        raise AssertionError("Popen is reserved for the Windows compatibility path")

    monkeypatch.setattr("geocopilot.app_server.shutil.which", lambda _name: "codex")
    monkeypatch.setattr(asyncio, "create_subprocess_exec", fake_asyncio_subprocess)
    monkeypatch.setattr("geocopilot.app_server.subprocess.Popen", unexpected_popen)

    await server.start(AgentSettings(api_key="test-key"))

    assert server.healthy is True
    assert [message["method"] for message in process.stdin.writes] == [
        "initialize",
        "initialized",
        "skills/list",
    ]
    await server.stop()
    assert process.returncode == -15


@pytest.mark.asyncio
async def test_popen_start_failure_is_a_user_facing_agent_error(tmp_path, monkeypatch):
    server = server_for(tmp_path, [])
    server._windows = True

    def broken_popen(*_args: Any, **_kwargs: Any) -> None:
        raise PermissionError("blocked by policy")

    monkeypatch.setattr("geocopilot.app_server.shutil.which", lambda _name: "codex")
    monkeypatch.setattr("geocopilot.app_server.subprocess.Popen", broken_popen)

    with pytest.raises(AppServerError, match="Could not start Codex App Server"):
        await server.start(AgentSettings(api_key="test-key"))
