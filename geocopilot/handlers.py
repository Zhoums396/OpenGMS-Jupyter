"""Authenticated REST and WebSocket handlers."""

from __future__ import annotations

import asyncio
import json
from typing import Any

from jupyter_server.auth.decorator import ws_authenticated
from jupyter_server.base.handlers import APIHandler, JupyterHandler
from jupyter_server.base.websocket import WebSocketMixin
from tornado import web, websocket

from .errors import GeoCopilotError
from .service import AgentService


class GeoCopilotAPIHandler(APIHandler):
    @property
    def agent(self) -> AgentService:
        return self.settings["geocopilot_service"]

    def write_error(self, status_code: int, **kwargs: Any) -> None:
        error = kwargs.get("exc_info", (None, None, None))[1]
        if isinstance(error, GeoCopilotError):
            self.set_header("Content-Type", "application/json")
            self.finish({"error": error.code, "message": str(error)})
            return
        super().write_error(status_code, **kwargs)

    def finish_domain_error(self, error: GeoCopilotError) -> None:
        self.set_status(error.status_code)
        self.finish({"error": error.code, "message": str(error)})


class StatusHandler(GeoCopilotAPIHandler):
    @web.authenticated
    async def get(self) -> None:
        self.finish(await self.agent.status())


class SettingsHandler(GeoCopilotAPIHandler):
    @web.authenticated
    async def get(self) -> None:
        self.finish(self.agent.settings().public())

    @web.authenticated
    async def put(self) -> None:
        try:
            self.finish(await self.agent.update_settings(self.get_json_body() or {}))
        except ValueError as error:
            self.set_status(400)
            self.finish({"error": "invalid_settings", "message": str(error)})
        except GeoCopilotError as error:
            self.finish_domain_error(error)


class ConversationHandler(GeoCopilotAPIHandler):
    @web.authenticated
    async def get(self) -> None:
        self.finish(self.agent.conversation())


class TurnHandler(GeoCopilotAPIHandler):
    @web.authenticated
    async def post(self) -> None:
        body = self.get_json_body() or {}
        try:
            result = await self.agent.start_turn(
                str(body.get("message") or ""),
                str(body.get("clientMessageId") or ""),
                body.get("context") if isinstance(body.get("context"), dict) else {},
            )
        except ValueError as error:
            raise web.HTTPError(400, reason=str(error)) from error
        except GeoCopilotError as error:
            self.finish_domain_error(error)
            return
        self.set_status(202)
        self.finish(result)


class CancelTurnHandler(GeoCopilotAPIHandler):
    @web.authenticated
    async def post(self, turn_id: str) -> None:
        try:
            await self.agent.cancel_turn(turn_id)
        except GeoCopilotError as error:
            self.finish_domain_error(error)
            return
        self.set_status(202)
        self.finish({"ok": True, "turnId": turn_id})


class ResetConversationHandler(GeoCopilotAPIHandler):
    @web.authenticated
    async def post(self) -> None:
        try:
            await self.agent.reset_conversation()
        except GeoCopilotError as error:
            self.finish_domain_error(error)
            return
        self.finish({"ok": True})


class EventsWebSocketHandler(
    WebSocketMixin, websocket.WebSocketHandler, JupyterHandler
):
    def initialize(self) -> None:
        self._queue: asyncio.Queue[dict[str, Any]] | None = None
        self._stream_task: asyncio.Task[None] | None = None
        self._sent_sequence = 0

    @property
    def agent(self) -> AgentService:
        return self.settings["geocopilot_service"]

    def set_default_headers(self) -> None:
        """Jupyter's REST headers do not apply to a WebSocket upgrade."""

    @ws_authenticated
    async def get(self, *args: Any, **kwargs: Any) -> None:
        await super().get(*args, **kwargs)

    async def open(self) -> None:
        super().open()
        after = int(self.get_query_argument("after", "0") or "0")
        self._queue = self.agent.subscribe()
        cursor = max(after, 0)
        while True:
            batch = self.agent.events_after(cursor)
            if not batch:
                break
            for event in batch:
                await self.write_message(json.dumps(event, ensure_ascii=False))
                cursor = int(event["sequence"])
            if len(batch) < 1000:
                break
        self._sent_sequence = cursor
        self._stream_task = asyncio.create_task(self._stream())

    async def _stream(self) -> None:
        assert self._queue is not None
        try:
            while True:
                event = await self._queue.get()
                if event.get("_overflow"):
                    self.close(1013, "event replay required")
                    return
                sequence = int(event.get("sequence") or 0)
                if sequence <= self._sent_sequence:
                    continue
                await self.write_message(json.dumps(event, ensure_ascii=False))
                self._sent_sequence = sequence
        except (asyncio.CancelledError, websocket.WebSocketClosedError):
            return

    def on_close(self) -> None:
        if self._queue is not None:
            self.agent.unsubscribe(self._queue)
        if self._stream_task and not self._stream_task.done():
            self._stream_task.cancel()


def handlers(base_url: str) -> list[tuple[Any, ...]]:
    prefix = base_url.rstrip("/") + "/geocopilot/api"
    return [
        (prefix + r"/status", StatusHandler),
        (prefix + r"/settings", SettingsHandler),
        (prefix + r"/conversation", ConversationHandler),
        (prefix + r"/turn", TurnHandler),
        (prefix + r"/turn/([^/]+)/cancel", CancelTurnHandler),
        (prefix + r"/conversation/reset", ResetConversationHandler),
        (prefix + r"/events", EventsWebSocketHandler),
    ]
