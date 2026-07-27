from __future__ import annotations

from geocopilot.state import StateStore


def test_running_turn_is_marked_interrupted_after_server_restart(tmp_path):
    path = tmp_path / "state.sqlite3"
    first = StateStore(path)
    first.set_thread_id("thread-1")
    first.create_turn("turn-1", "client-1")
    first.add_message("user", "hello", "turn-1")
    first.close()

    second = StateStore(path)
    assert second.active_turn() is None
    assert second.turn("turn-1")["state"] == "interrupted"
    event = second.events_after(0)[-1]
    assert event["type"] == "turn/interrupted"
    assert event["payload"]["reason"] == "server_restarted"
    assert second.thread_id() == "thread-1"
    second.close()


def test_events_are_ordered_replayable_and_messages_are_idempotent(tmp_path):
    state = StateStore(tmp_path / "state.sqlite3")
    state.create_turn("turn-1", "client-1")
    first = state.append_event("item/started", turn_id="turn-1")
    second = state.append_event("item/completed", turn_id="turn-1")
    assert second["sequence"] == first["sequence"] + 1
    assert [event["sequence"] for event in state.events_after(first["sequence"])] == [
        second["sequence"]
    ]
    assert [event["sequence"] for event in state.recent_events(1)] == [
        second["sequence"]
    ]
    assert state.turn_by_client_message("client-1")["turn_id"] == "turn-1"
    state.close()


def test_activity_tail_is_not_displaced_by_agent_message_deltas(tmp_path):
    state = StateStore(tmp_path / "state.sqlite3")
    started = state.append_event(
        "item/started",
        item_id="command-1",
        payload={"item": {"type": "commandExecution"}},
    )
    for _index in range(20):
        state.append_event("item/agentMessage/delta", payload={"delta": "token"})
    completed = state.append_event(
        "item/completed",
        item_id="command-1",
        payload={"item": {"type": "commandExecution"}},
    )

    activity = state.recent_activity_events(2)
    assert [event["sequence"] for event in activity] == [
        started["sequence"],
        completed["sequence"],
    ]
    state.close()
