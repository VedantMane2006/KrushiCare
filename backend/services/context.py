"""STUB context.py (owner: Krisha). Returns fixture values in the exact
DiagnosisResult shape. Real rules: backend/services/CONTEXT_RULES.md.
"""
from datetime import date, datetime, timedelta, timezone


def get_context(lat: float, lon: float, crop: str, soil_card: dict | None = None) -> dict:
    today = date.today()
    return {
        "weather_risk": {
            "level": "high",
            "rule": "hutton",
            "days": [{"date": (today + timedelta(days=i)).isoformat(), "favourable": i < 2} for i in range(3)],
            "source": "open-meteo",
            "fetched_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        },
        "soil": {
            "moisture": 0.21,
            "temperature_c": 24.5,
            "irrigation_key": "wait_for_rain",
            "card_values": soil_card,
            "flags": [],
        },
    }
