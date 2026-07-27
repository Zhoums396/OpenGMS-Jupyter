from __future__ import annotations

import inspect
import json
from pathlib import Path

import jsonschema

import geocopilot.context
import geocopilot.handlers
import geocopilot.service
from geocopilot.state import StateStore

ROOT = Path(__file__).parents[1]


def test_event_matches_replay_schema(tmp_path):
    state = StateStore(tmp_path / "state.sqlite3")
    event = state.append_event(
        "item/started",
        thread_id="thread-1",
        turn_id="turn-1",
        item_id="item-1",
        payload={"item": {"type": "commandExecution"}},
    )
    schema = json.loads((ROOT / "schema/events.schema.json").read_text())
    jsonschema.validate(event, schema)
    state.close()


def test_codex_compatibility_baseline_is_checked_in():
    schema_dir = ROOT / "schema/codex-0.142.2"
    assert (schema_dir / "ClientRequest.json").is_file()
    assert (schema_dir / "ServerNotification.json").is_file()
    assert (schema_dir / "v2/ThreadStartParams.json").is_file()
    assert (schema_dir / "v2/TurnStartParams.json").is_file()


def test_agent_backend_has_no_message_classifier_or_skill_router():
    source = "\n".join(
        inspect.getsource(module)
        for module in (
            geocopilot.context,
            geocopilot.handlers,
            geocopilot.service,
        )
    )
    assert "task_intent" not in source
    assert "intent_classifier" not in source
    assert "re.search(" not in source
    assert "OpenGMS" not in source

