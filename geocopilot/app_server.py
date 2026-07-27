"""Async JSON-RPC client for a private Codex App Server process."""

from __future__ import annotations

import asyncio
import contextlib
import json
import logging
import os
import shutil
import subprocess
import threading
from collections.abc import Awaitable, Callable
from pathlib import Path
from typing import Any, cast

from .config import BUNDLED_SKILL_NAMES, AgentSettings, SettingsStore
from .errors import GeoCopilotError

NotificationHandler = Callable[[dict[str, Any]], Awaitable[None]]
ExitHandler = Callable[[str], Awaitable[None]]
APP_SERVER_STREAM_LIMIT = 16 * 1024 * 1024


class AppServerError(GeoCopilotError):
    code = "agent_runtime_error"
    status_code = 502


class CodexAppServer:
    """Owns one stdio App Server for one Jupyter Server/user container."""

    def __init__(
        self,
        root_dir: Path,
        settings_store: SettingsStore,
        on_notification: NotificationHandler,
        on_exit: ExitHandler,
        log: logging.Logger,
    ):
        self.root_dir = root_dir
        self.settings_store = settings_store
        self.on_notification = on_notification
        self.on_exit = on_exit
        self.log = log
        self.process: asyncio.subprocess.Process | subprocess.Popen[bytes] | None = None
        self._windows = os.name == "nt"
        self._reader_task: asyncio.Task[None] | None = None
        self._stderr_task: asyncio.Task[None] | None = None
        self._wait_task: asyncio.Task[None] | None = None
        self._reader_thread: threading.Thread | None = None
        self._stderr_thread: threading.Thread | None = None
        self._wait_thread: threading.Thread | None = None
        self._loop: asyncio.AbstractEventLoop | None = None
        self._windows_messages: asyncio.Queue[dict[str, Any]] | None = None
        self._windows_dispatch_task: asyncio.Task[None] | None = None
        self._pending: dict[int, asyncio.Future[dict[str, Any]]] = {}
        self._request_id = 0
        self._write_lock = asyncio.Lock()
        self._lifecycle_lock = asyncio.Lock()
        self._stopping = False
        self.generation = 0

    @property
    def running(self) -> bool:
        if self.process is None:
            return False
        if self._windows:
            process = cast(Any, self.process)
            return process.poll() is None
        process = cast(asyncio.subprocess.Process, self.process)
        return process.returncode is None

    @property
    def event_reader_healthy(self) -> bool:
        if not self.running:
            return False
        if self._windows:
            return bool(
                self._reader_thread
                and self._reader_thread.is_alive()
                and self._windows_dispatch_task
                and not self._windows_dispatch_task.done()
            )
        return bool(self._reader_task and not self._reader_task.done())

    @property
    def healthy(self) -> bool:
        return self.running and self.event_reader_healthy

    async def start(self, settings: AgentSettings) -> None:
        async with self._lifecycle_lock:
            if self.healthy:
                return
            if self.running:
                await self._stop_unlocked()
            codex = os.environ.get("GEOCOPILOT_CODEX_BIN") or shutil.which("codex")
            if not codex:
                raise AppServerError(
                    "Codex CLI was not found. Install @openai/codex or set "
                    "GEOCOPILOT_CODEX_BIN."
                )
            self.settings_store.write_codex_config(settings)
            env = os.environ.copy()
            env.update(
                {
                    "CODEX_HOME": str(self.settings_store.codex_home),
                    "OPENAI_API_KEY": settings.api_key,
                }
            )
            self._stopping = False
            if self._windows:
                self._loop = asyncio.get_running_loop()
                self._windows_messages = asyncio.Queue()
                try:
                    # Jupyter Server intentionally uses SelectorEventLoop on Windows
                    # for Tornado and pyzmq compatibility. That loop cannot create
                    # asyncio subprocess transports, so use Popen only on Windows
                    # and relay its output through a dedicated async queue.
                    self.process = subprocess.Popen(
                        [codex, "app-server", "--listen", "stdio://"],
                        cwd=str(self.root_dir),
                        env=env,
                        stdin=subprocess.PIPE,
                        stdout=subprocess.PIPE,
                        stderr=subprocess.PIPE,
                        bufsize=0,
                    )
                except OSError as exc:
                    self._loop = None
                    self._windows_messages = None
                    raise AppServerError(f"Could not start Codex App Server: {exc}") from exc
            else:
                self.process = await asyncio.create_subprocess_exec(
                    codex,
                    "app-server",
                    "--listen",
                    "stdio://",
                    cwd=str(self.root_dir),
                    env=env,
                    stdin=asyncio.subprocess.PIPE,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                    limit=APP_SERVER_STREAM_LIMIT,
                )
            self.generation += 1
            process = self.process
            assert process is not None
            if self._windows:
                windows_process = cast(Any, process)
                self._windows_dispatch_task = asyncio.create_task(
                    self._dispatch_windows_messages()
                )
                self._reader_thread = self._start_thread(
                    "geocopilot-codex-stdout", self._read_stdout_blocking, windows_process
                )
                self._stderr_thread = self._start_thread(
                    "geocopilot-codex-stderr", self._read_stderr_blocking, windows_process
                )
                self._wait_thread = self._start_thread(
                    "geocopilot-codex-wait", self._wait_for_exit_blocking, windows_process
                )
            else:
                asyncio_process = cast(asyncio.subprocess.Process, process)
                self._reader_task = asyncio.create_task(self._read_stdout(asyncio_process))
                self._stderr_task = asyncio.create_task(self._read_stderr(asyncio_process))
                self._wait_task = asyncio.create_task(self._wait_for_exit(asyncio_process))
            try:
                await self.request(
                    "initialize",
                    {
                        "clientInfo": {
                            "name": "opengeolab_geocopilot",
                            "title": "GeoCopilot",
                            "version": "0.4.14",
                        },
                        "capabilities": {
                            "experimentalApi": False,
                            "mcpServerOpenaiFormElicitation": False,
                        },
                    },
                    timeout=30,
                )
                await self.notify("initialized", {})
                await self._verify_bundled_skills()
            except Exception:
                await self._stop_unlocked()
                raise

    async def stop(self) -> None:
        async with self._lifecycle_lock:
            await self._stop_unlocked()

    async def _stop_unlocked(self) -> None:
        self._stopping = True
        process = self.process
        self.process = None
        if self._windows and process is not None:
            windows_process = cast(Any, process)
            if windows_process.poll() is None:
                with contextlib.suppress(ProcessLookupError):
                    windows_process.terminate()
                try:
                    await asyncio.to_thread(windows_process.wait, 5)
                except subprocess.TimeoutExpired:
                    with contextlib.suppress(ProcessLookupError):
                        windows_process.kill()
                    await asyncio.to_thread(windows_process.wait)
            for thread in (self._reader_thread, self._stderr_thread, self._wait_thread):
                if thread and thread is not threading.current_thread():
                    await asyncio.to_thread(thread.join, 5)
            if self._windows_dispatch_task and not self._windows_dispatch_task.done():
                self._windows_dispatch_task.cancel()
                with contextlib.suppress(asyncio.CancelledError):
                    await self._windows_dispatch_task
        elif process is not None:
            asyncio_process = cast(asyncio.subprocess.Process, process)
            if asyncio_process.returncode is None:
                asyncio_process.terminate()
                try:
                    await asyncio.wait_for(asyncio_process.wait(), timeout=5)
                except asyncio.TimeoutError:
                    asyncio_process.kill()
                    await asyncio_process.wait()
            for task in (self._reader_task, self._stderr_task, self._wait_task):
                if task and not task.done() and task is not asyncio.current_task():
                    task.cancel()
        for future in self._pending.values():
            if not future.done():
                future.set_exception(AppServerError("Codex App Server stopped"))
        self._pending.clear()
        self._reader_thread = None
        self._stderr_thread = None
        self._wait_thread = None
        self._reader_task = None
        self._stderr_task = None
        self._wait_task = None
        self._loop = None
        self._windows_messages = None
        self._windows_dispatch_task = None

    async def restart(self, settings: AgentSettings) -> None:
        await self.stop()
        await self.start(settings)

    async def request(
        self,
        method: str,
        params: dict[str, Any] | None = None,
        timeout: float = 60,
    ) -> dict[str, Any]:
        if not self.running or not self.process or not self.process.stdin:
            raise AppServerError("Codex App Server is not running")
        self._request_id += 1
        request_id = self._request_id
        loop = asyncio.get_running_loop()
        future: asyncio.Future[dict[str, Any]] = loop.create_future()
        self._pending[request_id] = future
        await self._write({"id": request_id, "method": method, "params": params or {}})
        try:
            response = await asyncio.wait_for(future, timeout=timeout)
        except TimeoutError as exc:
            self._pending.pop(request_id, None)
            raise AppServerError(f"Timed out waiting for {method}") from exc
        if "error" in response:
            error = response.get("error") or {}
            raise AppServerError(str(error.get("message") or error))
        result = response.get("result")
        return result if isinstance(result, dict) else {}

    async def notify(self, method: str, params: dict[str, Any] | None = None) -> None:
        await self._write({"method": method, "params": params or {}})

    async def _write(self, message: dict[str, Any]) -> None:
        process = self.process
        if not process or not process.stdin or not self.running:
            raise AppServerError("Codex App Server is not writable")
        data = (json.dumps(message, ensure_ascii=False) + "\n").encode("utf-8")
        async with self._write_lock:
            if self._windows:
                windows_process = cast(Any, process)
                try:
                    await asyncio.to_thread(self._write_blocking, windows_process, data)
                except OSError as exc:
                    raise AppServerError(f"Codex App Server is not writable: {exc}") from exc
            else:
                asyncio_process = cast(asyncio.subprocess.Process, process)
                asyncio_process.stdin.write(data)
                await asyncio_process.stdin.drain()

    @staticmethod
    def _write_blocking(process: subprocess.Popen[bytes], data: bytes) -> None:
        if not process.stdin:
            raise OSError("stdin is closed")
        process.stdin.write(data)
        process.stdin.flush()

    def _start_thread(
        self,
        name: str,
        target: Callable[[subprocess.Popen[bytes]], None],
        process: subprocess.Popen[bytes],
    ) -> threading.Thread:
        thread = threading.Thread(name=name, target=target, args=(process,), daemon=True)
        thread.start()
        return thread

    async def _read_stdout(self, process: asyncio.subprocess.Process) -> None:
        if not process.stdout:
            return
        try:
            while True:
                line = await process.stdout.readline()
                if not line:
                    if process.returncode is None and not self._stopping:
                        await self._handle_reader_failure("event_stream_closed")
                    return
                try:
                    message = json.loads(line)
                except json.JSONDecodeError:
                    self.log.warning("Ignoring malformed Codex App Server output")
                    continue
                await self._handle_message(message)
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            self.log.exception("Codex App Server event reader failed")
            await self._handle_reader_failure(f"event_stream_failed:{type(exc).__name__}")

    async def _read_stderr(self, process: asyncio.subprocess.Process) -> None:
        if not process.stderr:
            return
        while True:
            line = await process.stderr.readline()
            if not line:
                return
            self.log.debug("codex-app-server: %s", line.decode("utf-8", "replace").rstrip())

    async def _wait_for_exit(self, process: asyncio.subprocess.Process) -> None:
        return_code = await process.wait()
        await self._handle_process_exit(process, return_code)

    def _read_stdout_blocking(self, process: subprocess.Popen[bytes]) -> None:
        if not process.stdout:
            return
        try:
            while True:
                line = process.stdout.readline()
                if not line:
                    if process.poll() is None and not self._stopping:
                        self._submit_to_loop(self._handle_reader_failure("event_stream_closed"))
                    return
                try:
                    message = json.loads(line)
                except json.JSONDecodeError:
                    self.log.warning("Ignoring malformed Codex App Server output")
                    continue
                self._enqueue_windows_message(message)
        except Exception as exc:
            self.log.exception("Codex App Server event reader failed")
            self._submit_to_loop(
                self._handle_reader_failure(f"event_stream_failed:{type(exc).__name__}")
            )

    def _read_stderr_blocking(self, process: subprocess.Popen[bytes]) -> None:
        if not process.stderr:
            return
        for line in iter(process.stderr.readline, b""):
            self.log.debug("codex-app-server: %s", line.decode("utf-8", "replace").rstrip())

    def _wait_for_exit_blocking(self, process: subprocess.Popen[bytes]) -> None:
        return_code = process.wait()
        self._submit_to_loop(self._handle_process_exit(process, return_code))

    def _enqueue_windows_message(self, message: dict[str, Any]) -> None:
        loop = self._loop
        messages = self._windows_messages
        if loop is None or loop.is_closed() or messages is None:
            return
        try:
            loop.call_soon_threadsafe(messages.put_nowait, message)
        except RuntimeError:
            return

    async def _dispatch_windows_messages(self) -> None:
        messages = self._windows_messages
        if messages is None:
            return
        try:
            while True:
                await self._handle_message(await messages.get())
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            self.log.exception("Codex App Server Windows event dispatcher failed")
            await self._handle_reader_failure(
                f"event_dispatch_failed:{type(exc).__name__}"
            )

    def _submit_to_loop(self, coroutine: Awaitable[None], wait: bool = False) -> None:
        loop = self._loop
        if loop is None or loop.is_closed():
            coroutine.close()
            return
        try:
            future = asyncio.run_coroutine_threadsafe(coroutine, loop)
            if wait:
                future.result()
        except RuntimeError:
            coroutine.close()

    async def _handle_message(self, message: dict[str, Any]) -> None:
        request_id = message.get("id")
        if request_id is not None and ("result" in message or "error" in message):
            future = self._pending.pop(int(request_id), None)
            if future and not future.done():
                future.set_result(message)
            return
        if request_id is not None and message.get("method"):
            await self._write(
                {
                    "id": request_id,
                    "error": {
                        "code": -32601,
                        "message": f"Unsupported client request: {message['method']}",
                    },
                }
            )
            return
        if message.get("method"):
            try:
                await self.on_notification(message)
            except Exception:
                self.log.exception("Failed to process Codex notification")

    async def _handle_process_exit(
        self,
        process: asyncio.subprocess.Process | subprocess.Popen[bytes],
        return_code: int,
    ) -> None:
        if self.process is process:
            self.process = None
        for future in self._pending.values():
            if not future.done():
                future.set_exception(
                    AppServerError(f"Codex App Server exited with code {return_code}")
                )
        self._pending.clear()
        if not self._stopping:
            with contextlib.suppress(Exception):
                await self.on_exit(f"process_exited:{return_code}")

    async def _handle_reader_failure(self, reason: str) -> None:
        if self._stopping:
            return
        self._stopping = True
        for future in self._pending.values():
            if not future.done():
                future.set_exception(AppServerError(reason))
        self._pending.clear()
        process = self.process
        if self._windows and process is not None:
            windows_process = cast(Any, process)
            if windows_process.poll() is None:
                with contextlib.suppress(ProcessLookupError):
                    windows_process.terminate()
        elif process is not None:
            asyncio_process = cast(asyncio.subprocess.Process, process)
            if asyncio_process.returncode is None:
                asyncio_process.terminate()
        with contextlib.suppress(Exception):
            await self.on_exit(reason)

    async def _verify_bundled_skills(self) -> None:
        result = await self.request(
            "skills/list",
            {"cwds": [str(self.root_dir)], "forceReload": True},
            timeout=30,
        )
        entries = result.get("data")
        if not isinstance(entries, list):
            raise AppServerError("Codex skills/list returned no data")
        names: set[str] = set()
        errors: list[str] = []
        for entry in entries:
            if not isinstance(entry, dict):
                continue
            for error in entry.get("errors") or []:
                if isinstance(error, dict):
                    errors.append(str(error.get("message") or error))
            for skill in entry.get("skills") or []:
                if isinstance(skill, dict) and skill.get("enabled") is True:
                    names.add(str(skill.get("name") or ""))
        missing = sorted(set(BUNDLED_SKILL_NAMES) - names)
        if missing:
            detail = f"; scan errors: {'; '.join(errors)}" if errors else ""
            raise AppServerError(
                f"Codex did not discover bundled Skills: {', '.join(missing)}{detail}"
            )
        self.log.info("Codex discovered bundled Skills: %s", ", ".join(BUNDLED_SKILL_NAMES))
