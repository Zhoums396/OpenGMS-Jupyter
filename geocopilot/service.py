"""Single-conversation GeoCopilot service."""

from __future__ import annotations

import asyncio
import copy
import logging
import time
import uuid
from pathlib import Path
from typing import Any

from .app_server import AppServerError, CodexAppServer
from .config import AgentSettings, SettingsStore
from .context import DEVELOPER_INSTRUCTIONS, build_turn_input
from .errors import AgentNotConfigured, TurnActive, TurnNotFound
from .state import StateStore

MAX_COMPLETED_OUTPUT_CHARS = 64 * 1024


class AgentService:
    def __init__(
        self,
        root_dir: Path,
        settings_store: SettingsStore,
        state: StateStore,
        log: logging.Logger,
    ):
        self.root_dir = root_dir
        self.settings_store = settings_store
        self.state = state
        self.log = log
        self._subscribers: set[asyncio.Queue[dict[str, Any]]] = set()
        self._start_lock = asyncio.Lock()
        self._starting = False
        self._loaded_generation = -1
        self._assistant_buffers: dict[str, str] = {}
        self._early_completions: dict[str, str] = {}
        self._reconcile_lock = asyncio.Lock()
        self._last_reconcile_at = 0.0
        self._closing = False
        self._shutdown_status: dict[str, Any] | None = None
        self._shutdown_conversation: dict[str, Any] | None = None
        self.app_server = CodexAppServer(
            root_dir,
            settings_store,
            self._on_notification,
            self._on_app_server_exit,
            log,
        )

    async def close(self) -> None:
        if self._closing:
            return
        # Jupyter can still serve a final browser poll while extensions are
        # shutting down. Capture a stable projection before closing SQLite so
        # those late reads do not fail with "closed database".
        self._shutdown_conversation = self.conversation()
        self._shutdown_status = {
            "configured": bool(self.settings().api_key),
            "appServerReady": False,
            "appServerRunning": False,
            "eventReaderHealthy": False,
            "runtimeState": "stopping",
            "rootDir": str(self.root_dir),
            "threadId": self.state.thread_id(),
            "activeTurn": self.state.active_turn(),
            "latestSequence": self.state.latest_sequence(),
        }
        self._closing = True
        await self.app_server.stop()
        self.state.close()

    def settings(self) -> AgentSettings:
        return self.settings_store.load()

    async def update_settings(self, payload: dict[str, Any]) -> dict[str, Any]:
        if self.state.active_turn() or self._starting:
            raise TurnActive("Settings cannot change while a turn is running")
        if payload.get("clearApiKey") is True:
            self.settings_store.clear_key()
            payload = {**payload, "apiKey": ""}
        settings = self.settings_store.update(payload)
        if self.app_server.running:
            await self.app_server.restart(settings)
        self._loaded_generation = -1
        await self._publish("settings/updated", payload=settings.public())
        return settings.public()

    async def status(self) -> dict[str, Any]:
        if self._closing and self._shutdown_status is not None:
            return copy.deepcopy(self._shutdown_status)
        await self._reconcile_active_turn()
        if self.app_server.healthy:
            runtime_state = "ready"
        elif self.app_server.running:
            runtime_state = "degraded"
        else:
            runtime_state = "idle"
        return {
            "configured": bool(self.settings().api_key),
            "appServerReady": self.app_server.healthy,
            "appServerRunning": self.app_server.running,
            "eventReaderHealthy": self.app_server.event_reader_healthy,
            "runtimeState": runtime_state,
            "rootDir": str(self.root_dir),
            "threadId": self.state.thread_id(),
            "activeTurn": self.state.active_turn(),
            "latestSequence": self.state.latest_sequence(),
        }

    def conversation(self) -> dict[str, Any]:
        if self._closing and self._shutdown_conversation is not None:
            return copy.deepcopy(self._shutdown_conversation)
        active = self.state.active_turn()
        return {
            "threadId": self.state.thread_id(),
            "messages": self.state.messages(),
            "activeTurn": active,
            "activeAssistantText": (
                self._assistant_buffers.get(str(active["turn_id"]), "") if active else ""
            ),
            "recentEvents": self.state.recent_activity_events(500),
            "latestSequence": self.state.latest_sequence(),
        }

    async def start_turn(
        self,
        message: str,
        client_message_id: str,
        context: dict[str, Any] | None,
    ) -> dict[str, Any]:
        message = message.strip()
        if not message:
            raise ValueError("message is required")
        client_message_id = client_message_id.strip() or uuid.uuid4().hex
        existing = self.state.turn_by_client_message(client_message_id)
        if existing:
            return {
                "threadId": self.state.thread_id(),
                "turnId": existing["turn_id"],
                "state": existing["state"],
                "duplicate": True,
            }

        async with self._start_lock:
            # A retry can arrive while the first request is waiting for
            # App Server startup. Re-check after acquiring the per-user lock
            # so the same client message never starts a second Codex turn.
            existing = self.state.turn_by_client_message(client_message_id)
            if existing:
                return {
                    "threadId": self.state.thread_id(),
                    "turnId": existing["turn_id"],
                    "state": existing["state"],
                    "duplicate": True,
                }
            if self._starting or self.state.active_turn():
                raise TurnActive("A GeoCopilot turn is already running")
            self._starting = True
            try:
                settings = self.settings()
                if not settings.api_key:
                    raise AgentNotConfigured("Configure an API key before starting a turn")
                await self.app_server.start(settings)
                thread_id = await self._ensure_thread(settings)
                turn_input = build_turn_input(message, context)
                result = await self.app_server.request(
                    "turn/start",
                    {
                        "threadId": thread_id,
                        "clientUserMessageId": client_message_id,
                        "input": [{"type": "text", "text": turn_input}],
                    },
                    timeout=60,
                )
                turn = result.get("turn") if isinstance(result.get("turn"), dict) else result
                turn_id = str(turn.get("id") or result.get("turnId") or "")
                if not turn_id:
                    raise AppServerError("Codex App Server did not return a turn ID")
                self.state.create_turn(turn_id, client_message_id)
                self.state.add_message("user", message, turn_id)
                self._assistant_buffers.setdefault(turn_id, "")
                early_status = self._early_completions.pop(turn_id, "")
                if early_status:
                    self._finish_turn(turn_id, early_status)
                self.log.info(
                    "GeoCopilot turn accepted thread_id=%s turn_id=%s",
                    thread_id,
                    turn_id,
                )
                await self._publish(
                    "turn/accepted",
                    thread_id=thread_id,
                    turn_id=turn_id,
                    payload={"clientMessageId": client_message_id},
                )
                return {
                    "threadId": thread_id,
                    "turnId": turn_id,
                    "state": "running",
                    "duplicate": False,
                }
            finally:
                self._starting = False

    async def cancel_turn(self, turn_id: str) -> None:
        active = self.state.active_turn()
        if not active or active["turn_id"] != turn_id:
            raise TurnNotFound(turn_id)
        await self.app_server.request(
            "turn/interrupt",
            {"threadId": self.state.thread_id(), "turnId": turn_id},
            timeout=30,
        )

    async def reset_conversation(self) -> None:
        if self.state.active_turn() or self._starting:
            raise TurnActive("Cannot reset while a turn is running")
        old_thread_id = self.state.thread_id()
        if old_thread_id and self.app_server.running:
            try:
                await self.app_server.request(
                    "thread/archive", {"threadId": old_thread_id}, timeout=30
                )
            except AppServerError:
                self.log.warning("Could not archive previous Codex thread", exc_info=True)
        self.state.reset_conversation()
        self._loaded_generation = -1
        await self._publish("conversation/reset")

    def events_after(self, sequence: int) -> list[dict[str, Any]]:
        return self.state.events_after(sequence)

    def subscribe(self) -> asyncio.Queue[dict[str, Any]]:
        queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue(maxsize=5000)
        self._subscribers.add(queue)
        return queue

    def unsubscribe(self, queue: asyncio.Queue[dict[str, Any]]) -> None:
        self._subscribers.discard(queue)

    async def _ensure_thread(self, settings: AgentSettings) -> str:
        thread_id = self.state.thread_id()
        if self._loaded_generation == self.app_server.generation and thread_id:
            return thread_id
        common = {
            "cwd": str(self.root_dir),
            "model": settings.model,
            "approvalPolicy": "never",
            "sandbox": "danger-full-access",
            "developerInstructions": DEVELOPER_INSTRUCTIONS,
        }
        if thread_id:
            result = await self.app_server.request(
                "thread/resume", {"threadId": thread_id, **common}, timeout=60
            )
        else:
            result = await self.app_server.request(
                "thread/start",
                {
                    "ephemeral": False,
                    "experimentalRawEvents": False,
                    "persistExtendedHistory": True,
                    **common,
                },
                timeout=60,
            )
            thread = result.get("thread") if isinstance(result.get("thread"), dict) else result
            thread_id = str(thread.get("id") or result.get("threadId") or "")
            if not thread_id:
                raise AppServerError("Codex App Server did not return a thread ID")
            self.state.set_thread_id(thread_id)
        self._loaded_generation = self.app_server.generation
        return thread_id

    async def _on_notification(self, message: dict[str, Any]) -> None:
        method = str(message.get("method") or "app-server/notification")
        params = message.get("params") if isinstance(message.get("params"), dict) else {}
        turn = params.get("turn") if isinstance(params.get("turn"), dict) else {}
        item = params.get("item") if isinstance(params.get("item"), dict) else {}
        turn_id = str(
            params.get("turnId")
            or turn.get("id")
            or item.get("turnId")
            or (self.state.active_turn() or {}).get("turn_id")
            or ""
        )
        item_id = str(params.get("itemId") or item.get("id") or "")
        await self._publish(
            method,
            thread_id=str(params.get("threadId") or self.state.thread_id()),
            turn_id=turn_id,
            item_id=item_id,
            payload=self._bounded_event_payload(params),
        )
        if method == "item/agentMessage/delta":
            delta = params.get("delta")
            if isinstance(delta, str) and turn_id:
                self._assistant_buffers[turn_id] = (
                    self._assistant_buffers.get(turn_id, "") + delta
                )
        elif method == "item/completed" and item.get("type") == "agentMessage" and turn_id:
            text = item.get("text") or item.get("content")
            if isinstance(text, str):
                self._assistant_buffers[turn_id] = text
        elif method == "turn/completed" and turn_id:
            status = str(turn.get("status") or params.get("status") or "completed")
            if self.state.turn(turn_id):
                self._finish_turn(turn_id, status)
            else:
                # App Server notifications can arrive immediately before the
                # matching turn/start response is processed.
                self._early_completions[turn_id] = status
        elif method in {"item/started", "item/completed"}:
            self.log.info(
                "GeoCopilot item event=%s thread_id=%s turn_id=%s item_id=%s item_type=%s",
                method,
                self.state.thread_id(),
                turn_id,
                item_id,
                str(item.get("type") or "unknown"),
            )

    async def _on_app_server_exit(self, reason: str) -> None:
        self._loaded_generation = -1
        active = self.state.active_turn()
        if active:
            turn_id = str(active["turn_id"])
            self.state.update_turn(turn_id, "interrupted")
            await self._publish(
                "turn/interrupted",
                turn_id=turn_id,
                payload={"reason": reason},
            )

    def _finish_turn(self, turn_id: str, status: str) -> None:
        record = self.state.turn(turn_id)
        normalized = "interrupted" if status == "interrupted" else "completed"
        if status in {"failed", "error"}:
            normalized = "failed"
        self.state.update_turn(turn_id, normalized)
        content = self._assistant_buffers.pop(turn_id, "").strip()
        if content and not self.state.has_message("assistant", turn_id):
            self.state.add_message("assistant", content, turn_id)
        duration = time.time() - float(record["started_at"]) if record else -1
        self.log.info(
            "GeoCopilot turn finished thread_id=%s turn_id=%s state=%s duration_seconds=%.3f",
            self.state.thread_id(),
            turn_id,
            normalized,
            duration,
        )

    async def _reconcile_active_turn(self) -> None:
        active = self.state.active_turn()
        if not active or not self.app_server.healthy:
            return
        now = time.monotonic()
        if now - self._last_reconcile_at < 2:
            return
        async with self._reconcile_lock:
            active = self.state.active_turn()
            if not active or not self.app_server.healthy:
                return
            self._last_reconcile_at = time.monotonic()
            try:
                result = await self.app_server.request(
                    "thread/read",
                    {"threadId": self.state.thread_id(), "includeTurns": True},
                    timeout=15,
                )
            except AppServerError:
                self.log.debug("Could not reconcile active Codex turn", exc_info=True)
                return
            thread = result.get("thread")
            turns = thread.get("turns") if isinstance(thread, dict) else None
            if not isinstance(turns, list):
                return
            turn_id = str(active["turn_id"])
            remote = next(
                (
                    turn
                    for turn in reversed(turns)
                    if isinstance(turn, dict) and str(turn.get("id") or "") == turn_id
                ),
                None,
            )
            if not isinstance(remote, dict):
                return
            remote_status = str(remote.get("status") or "")
            if remote_status not in {"completed", "interrupted", "failed"}:
                return
            text = self._last_agent_message(remote.get("items"))
            if text:
                self._assistant_buffers[turn_id] = text
            await self._publish(
                "turn/completed",
                turn_id=turn_id,
                payload={
                    "threadId": self.state.thread_id(),
                    "turn": {"id": turn_id, "status": remote_status},
                    "reconciled": True,
                },
            )
            self._finish_turn(turn_id, remote_status)

    @staticmethod
    def _last_agent_message(items: Any) -> str:
        if not isinstance(items, list):
            return ""
        messages = [
            item
            for item in items
            if isinstance(item, dict)
            and item.get("type") == "agentMessage"
            and isinstance(item.get("text"), str)
        ]
        if not messages:
            return ""
        final = [item for item in messages if item.get("phase") == "final_answer"]
        return str((final or messages)[-1]["text"])

    @staticmethod
    def _bounded_event_payload(payload: dict[str, Any]) -> dict[str, Any]:
        item = payload.get("item")
        if not isinstance(item, dict):
            return payload
        output = item.get("aggregatedOutput")
        if not isinstance(output, str) or len(output) <= MAX_COMPLETED_OUTPUT_CHARS:
            return payload
        bounded = copy.deepcopy(payload)
        bounded_item = bounded["item"]
        omitted = len(output) - MAX_COMPLETED_OUTPUT_CHARS
        bounded_item["aggregatedOutput"] = (
            f"[{omitted} earlier characters omitted]\n"
            + output[-MAX_COMPLETED_OUTPUT_CHARS:]
        )
        bounded_item["aggregatedOutputTruncated"] = True
        return bounded

    async def _publish(
        self,
        event_type: str,
        thread_id: str = "",
        turn_id: str = "",
        item_id: str = "",
        payload: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        event = self.state.append_event(
            event_type,
            thread_id or self.state.thread_id(),
            turn_id,
            item_id,
            payload or {},
        )
        stale: list[asyncio.Queue[dict[str, Any]]] = []
        for queue in self._subscribers:
            try:
                queue.put_nowait(event)
            except asyncio.QueueFull:
                stale.append(queue)
                # Tell the WebSocket to close so the browser reconnects and
                # replays the durable SQLite stream from its last sequence.
                try:
                    queue.get_nowait()
                    queue.put_nowait({"_overflow": True})
                except (asyncio.QueueEmpty, asyncio.QueueFull):
                    pass
        for queue in stale:
            self._subscribers.discard(queue)
        return event
