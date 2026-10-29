"""Weather, soil and late-blight risk for one location (owner: Krisha).

Implements backend/services/CONTEXT_RULES.md with one Open-Meteo forecast call.
Written by Saad so the app shows live weather early; Krisha owns refinements and
the stretch get_climate(). The rule functions are pure so tests run on canned JSON.

get_context(lat, lon, crop, soil_card=None) -> {"weather_risk": {...}, "soil": {...}}
in the exact DiagnosisResult shape. Raises on any network/data failure; the backend
then falls back to not_assessed.
"""
import threading
import time
from datetime import datetime, timedelta, timezone

import httpx

OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"
TIMEOUT_S = 6
CACHE_TTL_S = 3600

# Hutton criteria: min temperature >= 10 C and >= 6 hours with RH >= 90 %.
HUTTON_MIN_TEMP_C = 10.0
HUTTON_RH = 90.0
HUTTON_HUMID_HOURS = 6

RAIN_WAIT_MM = 5.0  # over the next 2 days
DRY_MOISTURE = 0.15  # m3/m3, 3-9 cm

# Soil Health Card "low" bands; pH ranges are crop optima.
SOIL_LIMITS = {
    "tomato": {"ph_low": 6.0, "ph_high": 7.5},
    "potato": {"ph_low": 5.0, "ph_high": 7.0},
}
NUTRIENT_LOW = {"n": 280.0, "p": 10.0, "k": 110.0, "oc": 0.5}

_cache: dict[tuple, tuple[float, dict]] = {}
_lock = threading.Lock()


# ---------- network ----------

def fetch_forecast(lat: float, lon: float) -> dict:
    params = {
        "latitude": round(lat, 2),
        "longitude": round(lon, 2),
        "hourly": "temperature_2m,relative_humidity_2m,soil_moisture_3_to_9cm,soil_temperature_6cm",
        "daily": "precipitation_sum",
        "forecast_days": 3,
        "timezone": "auto",
    }
    r = httpx.get(OPEN_METEO_URL, params=params, timeout=TIMEOUT_S)
    r.raise_for_status()
    return r.json()


def _cached_forecast(lat: float, lon: float) -> tuple[dict, str]:
    key = (round(lat, 2), round(lon, 2), datetime.now(timezone.utc).date().isoformat())
    now = time.time()
    with _lock:
        hit = _cache.get(key)
        if hit and now - hit[0] < CACHE_TTL_S:
            return hit[1]
    data = fetch_forecast(lat, lon)
    fetched_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
    with _lock:
        _cache[key] = (now, (data, fetched_at))
    return data, fetched_at


# ---------- rules (pure) ----------

def blight_days(data: dict) -> list[dict]:
    """[{date, favourable}] for each forecast day (Hutton criteria)."""
    h = data["hourly"]
    by_day: dict[str, list[tuple[float | None, float | None]]] = {}
    for t, temp, rh in zip(h["time"], h["temperature_2m"], h["relative_humidity_2m"]):
        by_day.setdefault(t[:10], []).append((temp, rh))
    days = []
    for d in data["daily"]["time"]:
        hours = by_day.get(d, [])
        temps = [t for t, _ in hours if t is not None]
        humid = sum(1 for _, rh in hours if rh is not None and rh >= HUTTON_RH)
        favourable = bool(temps) and min(temps) >= HUTTON_MIN_TEMP_C and humid >= HUTTON_HUMID_HOURS
        days.append({"date": d, "favourable": favourable})
    return days


def risk_level(days: list[dict]) -> str:
    fav = [d["favourable"] for d in days]
    if any(a and b for a, b in zip(fav, fav[1:])):
        return "high"  # a Hutton period: two consecutive favourable days
    return "medium" if any(fav) else "low"


def _now_index(data: dict) -> int:
    """Index of the current local hour in the hourly arrays (clamped)."""
    times = data["hourly"]["time"]
    local = datetime.now(timezone.utc) + timedelta(seconds=data.get("utc_offset_seconds", 0))
    stamp = local.strftime("%Y-%m-%dT%H:00")
    if stamp in times:
        return times.index(stamp)
    return 0 if stamp < times[0] else len(times) - 1


def current_soil(data: dict) -> tuple[float | None, float | None]:
    h = data["hourly"]
    i = _now_index(data)

    def nearest(series):
        # The current hour can be null at the edges of the model run; take the nearest value.
        for j in sorted(range(len(series)), key=lambda j: abs(j - i)):
            if series[j] is not None:
                return series[j]
        return None

    m = nearest(h.get("soil_moisture_3_to_9cm") or [])
    t = nearest(h.get("soil_temperature_6cm") or [])
    return (round(m, 2) if m is not None else None, round(t, 1) if t is not None else None)


def irrigation_key(data: dict, moisture: float | None) -> str:
    rain = sum(v or 0 for v in data["daily"]["precipitation_sum"][:2])
    if rain >= RAIN_WAIT_MM:
        return "wait_for_rain"
    if moisture is None:
        return "unknown"
    return "consider_irrigating" if moisture < DRY_MOISTURE else "no_action"


def soil_flags(crop: str, card: dict | None) -> list[str]:
    if not card:
        return []
    flags = []
    lim = SOIL_LIMITS.get(crop, SOIL_LIMITS["tomato"])
    ph = card.get("ph")
    if ph is not None:
        if ph < lim["ph_low"]:
            flags.append("ph_low")
        elif ph > lim["ph_high"]:
            flags.append("ph_high")
    for k, low in NUTRIENT_LOW.items():
        v = card.get(k)
        if v is not None and v < low:
            flags.append(f"{k}_low")
    return flags


def build_context(data: dict, fetched_at: str, crop: str, soil_card: dict | None) -> dict:
    days = blight_days(data)
    moisture, temp = current_soil(data)
    return {
        "weather_risk": {"level": risk_level(days), "rule": "hutton", "days": days,
                         "source": "open-meteo", "fetched_at": fetched_at},
        "soil": {"moisture": moisture, "temperature_c": temp, "irrigation_key": irrigation_key(data, moisture),
                 "card_values": soil_card, "flags": soil_flags(crop, soil_card)},
    }


def get_context(lat: float, lon: float, crop: str, soil_card: dict | None = None) -> dict:
    data, fetched_at = _cached_forecast(lat, lon)
    return build_context(data, fetched_at, crop, soil_card)
