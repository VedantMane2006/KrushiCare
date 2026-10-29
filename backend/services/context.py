"""Weather, soil, late-blight risk and the season-vs-normal climate card (owner: Krisha).

Implements backend/services/CONTEXT_RULES.md with one Open-Meteo forecast call.
Written by Saad so the app shows live weather early; Krisha owns refinements and
the stretch get_climate(). The rule functions are pure so tests run on canned JSON.

get_context(lat, lon, crop, soil_card=None) -> {"weather_risk": {...}, "soil": {...}}
in the exact DiagnosisResult shape. Raises on any network/data failure; the backend
then falls back to not_assessed.
"""
import threading
import time
from datetime import date, datetime, timedelta, timezone

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


# ---------- climate card (stretch): this season vs the 1991-2020 normal ----------

ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"
ARCHIVE_LAG_DAYS = 6  # ERA5 reanalysis reaches the archive about 5 days late
NORMAL_YEARS = (1991, 2020)
CLIMATE_TTL_S = 24 * 3600
_climate_cache: dict[tuple, tuple[float, dict]] = {}

# Indian cropping seasons as (start month, start day); rabi runs across the new year.
SEASONS = [("zaid", 3, 1), ("kharif", 6, 1), ("rabi", 10, 1)]


def season_window(today):
    """(season, start_date, end_date) for the season that contains `today`, ending at the archive lag.

    Early in a season (under a week of data), use the previous season instead.
    """
    def start_of(d):
        for name, m, dd in reversed(SEASONS):
            s = date(d.year, m, dd)
            if d >= s:
                return name, s
        return "rabi", date(d.year - 1, 10, 1)

    end = today - timedelta(days=ARCHIVE_LAG_DAYS)
    name, start = start_of(end)
    if (end - start).days < 7:
        name, start = start_of(start - timedelta(days=1))
    return name, start, end


def fetch_archive(lat: float, lon: float, start: str, end: str) -> dict:
    params = {"latitude": round(lat, 2), "longitude": round(lon, 2), "start_date": start, "end_date": end,
              "daily": "precipitation_sum,temperature_2m_mean", "timezone": "auto"}
    r = httpx.get(ARCHIVE_URL, params=params, timeout=20)
    r.raise_for_status()
    return r.json()


def _window_stats(daily: dict, start_md: tuple[int, int], length_days: int, year_start: int) -> tuple[float, float] | None:
    """Total rain and mean temperature for one year's copy of the season window."""
    s = date(year_start, *start_md)
    e = s + timedelta(days=length_days)
    rain, temps, n = 0.0, [], 0
    for t, p, tm in zip(daily["time"], daily["precipitation_sum"], daily["temperature_2m_mean"]):
        d = date.fromisoformat(t)
        if s <= d <= e:
            n += 1
            rain += p or 0
            if tm is not None:
                temps.append(tm)
    if n < length_days * 0.9 or not temps:
        return None
    return rain, sum(temps) / len(temps)


def climate_summary(season: str, start, end, current: dict, normal: dict) -> dict:
    """Pure: compare this season so far with the same calendar window in each normal year."""
    length = (end - start).days
    now = _window_stats(current["daily"], (start.month, start.day), length, start.year)
    if now is None:
        raise ValueError("not enough data for this season yet")
    years = [_window_stats(normal["daily"], (start.month, start.day), length, y) for y in range(NORMAL_YEARS[0], NORMAL_YEARS[1] + 1)]
    years = [y for y in years if y]
    if len(years) < 20:
        raise ValueError("not enough data for the normal")
    n_rain = sum(r for r, _ in years) / len(years)
    n_temp = sum(t for _, t in years) / len(years)
    rain, temp = now
    return {
        "season": season,
        "period": {"start": start.isoformat(), "end": end.isoformat()},
        "rain_mm": round(rain, 1),
        "normal_rain_mm": round(n_rain, 1),
        "rain_pct_of_normal": round(100 * rain / n_rain) if n_rain >= 1 else None,
        "temp_c": round(temp, 1),
        "normal_temp_c": round(n_temp, 1),
        "temp_anomaly_c": round(temp - n_temp, 1),
        "baseline": f"{NORMAL_YEARS[0]}-{NORMAL_YEARS[1]}",
        "source": "open-meteo-archive",
    }


def get_climate(lat: float, lon: float) -> dict:
    season, start, end = season_window(date.today())
    key = (round(lat, 1), round(lon, 1), start.isoformat(), end.isoformat())
    now = time.time()
    with _lock:
        hit = _climate_cache.get(key)
        if hit and now - hit[0] < CLIMATE_TTL_S:
            return hit[1]
    current = fetch_archive(lat, lon, start.isoformat(), end.isoformat())
    # One call for all 30 baseline years; rabi windows run into the following year.
    normal = fetch_archive(lat, lon, f"{NORMAL_YEARS[0]}-{start.month:02d}-{start.day:02d}", f"{NORMAL_YEARS[1] + 1}-06-30")
    out = climate_summary(season, start, end, current, normal)
    with _lock:
        _climate_cache[key] = (now, out)
    return out
