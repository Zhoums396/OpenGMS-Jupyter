"""SQLite-backed conversation, turn, and replayable event state."""

from __future__ import annotations

import json
import sqlite3
import threading
import time
import uuid
from pathlib import Path
from typing import Any


class StateStore:
    def __init__(self, path: Path):
        self.path = path
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.RLock()
        self._connection = sqlite3.connect(path, check_same_thread=False)
        self._connection.row_factory = sqlite3.Row
        self._connection.execute("PRAGMA journal_mode=WAL")
        self._connection.execute("PRAGMA foreign_keys=ON")
        self._initialize()

    def _initialize(self) -> None:
        with self._lock, self._connection:
            self._connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS metadata (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS turns (
                    turn_id TEXT PRIMARY KEY,
                    client_message_id TEXT NOT NULL UNIQUE,
                    state TEXT NOT NULL,
                    started_at REAL NOT NULL,
                    completed_at REAL
                );
                CREATE TABLE IF NOT EXISTS messages (
                    message_id TEXT PRIMARY KEY,
                    turn_id TEXT,
                    role TEXT NOT NULL,
                    content TEXT NOT NULL,
                    created_at REAL NOT NULL
                );
                CREATE TABLE IF NOT EXISTS events (
                    sequence INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp REAL NOT NULL,
                    type TEXT NOT NULL,
                    thread_id TEXT,
                    turn_id TEXT,
                    item_id TEXT,
                    payload TEXT NOT NULL
                );
                """
            )
            running = self._connection.execute(
                "SELECT turn_id FROM turns WHERE state IN ('starting', 'running')"
            ).fetchall()
            for row in running:
                self._connection.execute(
                    "UPDATE turns SET state='interrupted', completed_at=? WHERE turn_id=?",
                    (time.time(), row["turn_id"]),
                )
                self._insert_event(
                    "turn/interrupted",
                    self.thread_id(),
                    row["turn_id"],
                    "",
                    {"reason": "server_restarted"},
                )

    def close(self) -> None:
        with self._lock:
            self._connection.close()

    def get_meta(self, key: str, default: str = "") -> str:
        with self._lock:
            row = self._connection.execute(
                "SELECT value FROM metadata WHERE key=?", (key,)
            ).fetchone()
            return str(row["value"]) if row else default

    def set_meta(self, key: str, value: str) -> None:
        with self._lock, self._connection:
            self._connection.execute(
                """
                INSERT INTO metadata(key, value) VALUES(?, ?)
                ON CONFLICT(key) DO UPDATE SET value=excluded.value
                """,
                (key, value),
            )

    def thread_id(self) -> str:
        return self.get_meta("thread_id")

    def set_thread_id(self, thread_id: str) -> None:
        self.set_meta("thread_id", thread_id)

    def active_turn(self) -> dict[str, Any] | None:
        with self._lock:
            row = self._connection.execute(
                """
                SELECT * FROM turns
                WHERE state IN ('starting', 'running')
                ORDER BY started_at DESC LIMIT 1
                """
            ).fetchone()
            return dict(row) if row else None

    def turn_by_client_message(self, client_message_id: str) -> dict[str, Any] | None:
        with self._lock:
            row = self._connection.execute(
                "SELECT * FROM turns WHERE client_message_id=?", (client_message_id,)
            ).fetchone()
            return dict(row) if row else None

    def turn(self, turn_id: str) -> dict[str, Any] | None:
        with self._lock:
            row = self._connection.execute(
                "SELECT * FROM turns WHERE turn_id=?", (turn_id,)
            ).fetchone()
            return dict(row) if row else None

    def create_turn(self, turn_id: str, client_message_id: str, state: str = "running") -> None:
        with self._lock, self._connection:
            self._connection.execute(
                """
                INSERT INTO turns(turn_id, client_message_id, state, started_at)
                VALUES(?, ?, ?, ?)
                """,
                (turn_id, client_message_id, state, time.time()),
            )

    def update_turn(self, turn_id: str, state: str) -> None:
        completed_at = None if state in {"starting", "running"} else time.time()
        with self._lock, self._connection:
            self._connection.execute(
                "UPDATE turns SET state=?, completed_at=? WHERE turn_id=?",
                (state, completed_at, turn_id),
            )

    def add_message(self, role: str, content: str, turn_id: str = "") -> dict[str, Any]:
        message = {
            "messageId": uuid.uuid4().hex,
            "turnId": turn_id,
            "role": role,
            "content": content,
            "createdAt": time.time(),
        }
        with self._lock, self._connection:
            self._connection.execute(
                """
                INSERT INTO messages(message_id, turn_id, role, content, created_at)
                VALUES(?, ?, ?, ?, ?)
                """,
                (
                    message["messageId"],
                    message["turnId"],
                    message["role"],
                    message["content"],
                    message["createdAt"],
                ),
            )
        return message

    def has_message(self, role: str, turn_id: str) -> bool:
        with self._lock:
            row = self._connection.execute(
                "SELECT 1 FROM messages WHERE role=? AND turn_id=? LIMIT 1",
                (role, turn_id),
            ).fetchone()
            return row is not None

    def messages(self) -> list[dict[str, Any]]:
        with self._lock:
            rows = self._connection.execute(
                "SELECT * FROM messages ORDER BY created_at, rowid"
            ).fetchall()
        return [
            {
                "messageId": row["message_id"],
                "turnId": row["turn_id"] or "",
                "role": row["role"],
                "content": row["content"],
                "createdAt": row["created_at"],
            }
            for row in rows
        ]

    def append_event(
        self,
        event_type: str,
        thread_id: str = "",
        turn_id: str = "",
        item_id: str = "",
        payload: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        with self._lock, self._connection:
            return self._insert_event(
                event_type, thread_id, turn_id, item_id, payload or {}
            )

    def _insert_event(
        self,
        event_type: str,
        thread_id: str,
        turn_id: str,
        item_id: str,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        timestamp = time.time()
        cursor = self._connection.execute(
            """
            INSERT INTO events(timestamp, type, thread_id, turn_id, item_id, payload)
            VALUES(?, ?, ?, ?, ?, ?)
            """,
            (
                timestamp,
                event_type,
                thread_id,
                turn_id,
                item_id,
                json.dumps(payload, ensure_ascii=False),
            ),
        )
        return {
            "sequence": int(cursor.lastrowid),
            "timestamp": timestamp,
            "type": event_type,
            "threadId": thread_id,
            "turnId": turn_id,
            "itemId": item_id,
            "payload": payload,
        }

    def events_after(self, sequence: int, limit: int = 1000) -> list[dict[str, Any]]:
        with self._lock:
            rows = self._connection.execute(
                """
                SELECT * FROM events WHERE sequence > ?
                ORDER BY sequence LIMIT ?
                """,
                (max(sequence, 0), min(max(limit, 1), 5000)),
            ).fetchall()
        return [
            {
                "sequence": row["sequence"],
                "timestamp": row["timestamp"],
                "type": row["type"],
                "threadId": row["thread_id"] or "",
                "turnId": row["turn_id"] or "",
                "itemId": row["item_id"] or "",
                "payload": json.loads(row["payload"]),
            }
            for row in rows
        ]

    def latest_sequence(self) -> int:
        with self._lock:
            row = self._connection.execute(
                "SELECT COALESCE(MAX(sequence), 0) AS sequence FROM events"
            ).fetchone()
            return int(row["sequence"])

    def recent_events(self, limit: int = 120) -> list[dict[str, Any]]:
        """Return a chronological tail for rebuilding the browser projection."""
        with self._lock:
            rows = self._connection.execute(
                """
                SELECT * FROM (
                    SELECT * FROM events ORDER BY sequence DESC LIMIT ?
                )
                ORDER BY sequence
                """,
                (min(max(limit, 1), 1000),),
            ).fetchall()
        return [
            {
                "sequence": row["sequence"],
                "timestamp": row["timestamp"],
                "type": row["type"],
                "threadId": row["thread_id"] or "",
                "turnId": row["turn_id"] or "",
                "itemId": row["item_id"] or "",
                "payload": json.loads(row["payload"]),
            }
            for row in rows
        ]

    def recent_activity_events(self, limit: int = 500) -> list[dict[str, Any]]:
        """Return a tail that cannot be displaced by streamed answer tokens."""
        visible_types = (
            "turn/accepted",
            "turn/completed",
            "turn/interrupted",
            "error",
            "item/started",
            "item/completed",
            "item/commandExecution/outputDelta",
            "item/fileChange/outputDelta",
            "item/mcpToolCall/progress",
        )
        placeholders = ",".join("?" for _value in visible_types)
        with self._lock:
            rows = self._connection.execute(
                f"""
                SELECT * FROM (
                    SELECT * FROM events
                    WHERE type IN ({placeholders})
                    ORDER BY sequence DESC LIMIT ?
                )
                ORDER BY sequence
                """,
                (*visible_types, min(max(limit, 1), 2000)),
            ).fetchall()
        return [
            {
                "sequence": row["sequence"],
                "timestamp": row["timestamp"],
                "type": row["type"],
                "threadId": row["thread_id"] or "",
                "turnId": row["turn_id"] or "",
                "itemId": row["item_id"] or "",
                "payload": json.loads(row["payload"]),
            }
            for row in rows
        ]

    def reset_conversation(self) -> None:
        with self._lock, self._connection:
            self._connection.execute("DELETE FROM turns")
            self._connection.execute("DELETE FROM messages")
            self._connection.execute("DELETE FROM events")
            self._connection.execute("DELETE FROM metadata WHERE key='thread_id'")
