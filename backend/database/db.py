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
    # WhatsApp bot preferences. The phone number is stored only as a salted hash.
    _conn.execute(
        "CREATE TABLE IF NOT EXISTS wa_users ("
        " user_key TEXT PRIMARY KEY, crop TEXT, lang TEXT, lat REAL, lon REAL, updated_at TEXT NOT NULL)"
    )
    _conn.commit()


def wa_get(user_key: str) -> dict:
    with _lock:
        row = _conn.execute("SELECT crop, lang, lat, lon FROM wa_users WHERE user_key = ?", (user_key,)).fetchone()
    return dict(zip(("crop", "lang", "lat", "lon"), row)) if row else {"crop": None, "lang": None, "lat": None, "lon": None}


def wa_put(user_key: str, prefs: dict) -> None:
    with _lock:
        _conn.execute(
            "INSERT OR REPLACE INTO wa_users (user_key, crop, lang, lat, lon, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
            (user_key, prefs.get("crop"), prefs.get("lang"), prefs.get("lat"), prefs.get("lon"),
             datetime.now(timezone.utc).isoformat()),
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
