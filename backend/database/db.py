"""SQLite store of results keyed by client_id, for idempotent retries. No images are stored."""
import json
import os
import sqlite3
import threading
from datetime import datetime, timezone
from pathlib import Path

_lock = threading.Lock()
_conn: sqlite3.Connection | None = None


def init(path: str | None = None) -> None:
    global _conn
    path = path or os.environ.get("DB_PATH", str(Path(__file__).resolve().parents[1] / "agrisense.db"))
    _conn = sqlite3.connect(path, check_same_thread=False)
    _conn.execute(
        "CREATE TABLE IF NOT EXISTS diagnoses ("
        " client_id TEXT PRIMARY KEY, created_at TEXT NOT NULL, result_json TEXT NOT NULL)"
    )
    _conn.commit()


def get(client_id: str) -> dict | None:
    with _lock:
        row = _conn.execute("SELECT result_json FROM diagnoses WHERE client_id = ?", (client_id,)).fetchone()
    return json.loads(row[0]) if row else None


def put(client_id: str, result: dict) -> dict:
    """Insert unless present; return whatever is stored (first write wins)."""
    with _lock:
        _conn.execute(
            "INSERT OR IGNORE INTO diagnoses (client_id, created_at, result_json) VALUES (?, ?, ?)",
            (client_id, datetime.now(timezone.utc).isoformat(), json.dumps(result, ensure_ascii=False)),
        )
        _conn.commit()
        row = _conn.execute("SELECT result_json FROM diagnoses WHERE client_id = ?", (client_id,)).fetchone()
    return json.loads(row[0])
