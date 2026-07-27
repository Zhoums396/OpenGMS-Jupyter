from __future__ import annotations

import asyncio
import logging

import pytest

from geocopilot.config import SettingsStore
from geocopilot.errors import TurnActive
from geocopilot.service import AgentService
from geocopilot.state import StateStore


class FakeAppServer:
    def __init__(self):
        self.running = False
        self.healthy = False
        self.event_reader_healthy = False
        self.generation = 0
        self.calls: list[tuple[str, dict]] = []
        self.turn_count = 0
        self.remote_turn: dict | None = None

    async def start(self, _settings):
        if self.running:
            return
        self.running = True
        self.healthy = True
        self.event_reader_healthy = True
        self.generation += 1

    async def stop(self):
        self.running = False
        self.healthy = False
        self.event_reader_healthy = False

    async def restart(self, settings):
        await self.stop()
        await self.start(settings)

    async def request(self, method, params, timeout=60):
        self.calls.append((method, params))
        if method == "thread/start":
            return {"thread": {"id": "thread-1"}}
        if method == "turn/start":
            self.turn_count += 1
            return {"turn": {"id": f"turn-{self.turn_count}"}}
        if method == "thread/read":
            return {"thread": {"turns": [self.remote_turn] if self.remote_turn else []}}
        return {}


@pytest.mark.asyncio
async def test_one_message_creates_one_codex_turn_without_classifier(tmp_path):
    settings = SettingsStore(tmp_path / "config", tmp_path / "data")
    settings.update({"apiKey": "test-key", "model": "gpt-test"})
    state = StateStore(tmp_path / "state.sqlite3")
    service = AgentService(tmp_path, settings, state, logging.getLogger("test"))
    fake = FakeAppServer()
    service.app_server = fake

    result = await service.start_turn(
        "Inspect the workspace",
        "client-message-1",
        {"activeNotebookPath": "analysis.ipynb", "activeCellId": "cell-a"},
    )
    duplicate = await service.start_turn("Inspect the workspace", "client-message-1", {})

    assert result["turnId"] == "turn-1"
    assert duplicate["duplicate"] is True
    assert [method for method, _params in fake.calls].count("turn/start") == 1
    turn_params = next(params for method, params in fake.calls if method == "turn/start")
    assert len(turn_params["input"]) == 1
    assert "<situational_context>" in turn_params["input"][0]["text"]
    assert state.messages()[0]["content"] == "Inspect the workspace"
    await service.close()


@pytest.mark.asyncio
async def test_late_browser_reads_are_safe_during_shutdown(tmp_path):
    settings = SettingsStore(tmp_path / "config", tmp_path / "data")
    settings.update({"apiKey": "test-key"})
    state = StateStore(tmp_path / "state.sqlite3")
    service = AgentService(tmp_path, settings, state, logging.getLogger("test"))
    service.app_server = FakeAppServer()
    await service.start_turn("work", "client-1", {})

    await service.close()

    status = await service.status()
    conversation = service.conversation()
    assert status["runtimeState"] == "stopping"
    assert status["appServerReady"] is False
    assert conversation["threadId"] == "thread-1"
    assert conversation["activeTurn"]["turn_id"] == "turn-1"


@pytest.mark.asyncio
async def test_second_message_is_rejected_while_turn_is_active(tmp_path):
    settings = SettingsStore(tmp_path / "config", tmp_path / "data")
    settings.update({"apiKey": "test-key"})
    state = StateStore(tmp_path / "state.sqlite3")
    service = AgentService(tmp_path, settings, state, logging.getLogger("test"))
    service.app_server = FakeAppServer()
    await service.start_turn("first", "client-1", {})
    with pytest.raises(TurnActive):
        await service.start_turn("second", "client-2", {})
    await service.close()


@pytest.mark.asyncio
async def test_concurrent_retry_with_same_client_id_is_idempotent(tmp_path):
    settings = SettingsStore(tmp_path / "config", tmp_path / "data")
    settings.update({"apiKey": "test-key"})
    state = StateStore(tmp_path / "state.sqlite3")
    service = AgentService(tmp_path, settings, state, logging.getLogger("test"))
    fake = FakeAppServer()
    service.app_server = fake

    first, retry = await asyncio.gather(
        service.start_turn("same message", "stable-client-id", {}),
        service.start_turn("same message", "stable-client-id", {}),
    )

    assert {first["duplicate"], retry["duplicate"]} == {False, True}
    assert first["turnId"] == retry["turnId"] == "turn-1"
    assert [method for method, _params in fake.calls].count("turn/start") == 1
    await service.close()


@pytest.mark.asyncio
async def test_cancel_interrupts_exact_turn_and_completion_updates_projection(tmp_path):
    settings = SettingsStore(tmp_path / "config", tmp_path / "data")
    settings.update({"apiKey": "test-key"})
    state = StateStore(tmp_path / "state.sqlite3")
    service = AgentService(tmp_path, settings, state, logging.getLogger("test"))
    fake = FakeAppServer()
    service.app_server = fake

    await service.start_turn("work", "client-1", {})
    await service.cancel_turn("turn-1")
    assert fake.calls[-1] == (
        "turn/interrupt",
        {"threadId": "thread-1", "turnId": "turn-1"},
    )

    await service._on_notification(
        {
            "method": "item/agentMessage/delta",
            "params": {"threadId": "thread-1", "turnId": "turn-1", "delta": "Done"},
        }
    )
    await service._on_notification(
        {
            "method": "turn/completed",
            "params": {
                "threadId": "thread-1",
                "turn": {"id": "turn-1", "status": "interrupted"},
            },
        }
    )

    projection = service.conversation()
    assert projection["activeTurn"] is None
    assert projection["messages"][-1]["content"] == "Done"
    assert projection["recentEvents"][-1]["type"] == "turn/completed"
    assert state.turn("turn-1")["state"] == "interrupted"
    await service.close()


@pytest.mark.asyncio
async def test_settings_restart_resumes_persistent_thread(tmp_path):
    settings = SettingsStore(tmp_path / "config", tmp_path / "data")
    settings.update({"apiKey": "test-key", "model": "model-a"})
    state = StateStore(tmp_path / "state.sqlite3")
    service = AgentService(tmp_path, settings, state, logging.getLogger("test"))
    fake = FakeAppServer()
    service.app_server = fake

    await service.start_turn("first", "client-1", {})
    await service._on_notification(
        {
            "method": "turn/completed",
            "params": {
                "threadId": "thread-1",
                "turn": {"id": "turn-1", "status": "completed"},
            },
        }
    )
    await service.update_settings({"apiKey": "replacement", "model": "model-b"})
    await service.start_turn("second", "client-2", {})

    resume = next(params for method, params in fake.calls if method == "thread/resume")
    assert resume["threadId"] == "thread-1"
    assert resume["model"] == "model-b"
    assert fake.generation == 2
    await service.close()


@pytest.mark.asyncio
async def test_status_reconciles_a_completion_missed_by_the_event_stream(tmp_path):
    settings = SettingsStore(tmp_path / "config", tmp_path / "data")
    settings.update({"apiKey": "test-key"})
    state = StateStore(tmp_path / "state.sqlite3")
    service = AgentService(tmp_path, settings, state, logging.getLogger("test"))
    fake = FakeAppServer()
    service.app_server = fake

    await service.start_turn("work", "client-1", {})
    fake.remote_turn = {
        "id": "turn-1",
        "status": "completed",
        "items": [{"id": "message-1", "type": "agentMessage", "text": "Recovered answer"}],
    }
    status = await service.status()

    assert status["activeTurn"] is None
    assert status["runtimeState"] == "ready"
    assert state.turn("turn-1")["state"] == "completed"
    assert service.conversation()["messages"][-1]["content"] == "Recovered answer"
    assert service.conversation()["recentEvents"][-1]["payload"]["reconciled"] is True
    await service.close()


def test_large_completed_command_output_is_bounded_for_event_replay():
    payload = {
        "item": {
            "type": "commandExecution",
            "aggregatedOutput": "x" * (70 * 1024),
        }
    }
    bounded = AgentService._bounded_event_payload(payload)
    assert bounded["item"]["aggregatedOutputTruncated"] is True
    assert len(bounded["item"]["aggregatedOutput"]) < 66 * 1024
    assert len(payload["item"]["aggregatedOutput"]) == 70 * 1024
