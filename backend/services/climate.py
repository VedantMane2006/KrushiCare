"""Climate card: this season's rain and temperature vs the 1991-2020 normal (GET /api/climate).

Split out of context.py so the weather/soil module (Krisha) and this card evolve separately.
One Open-Meteo archive (ERA5) call for this season and one for the 30 baseline years, cached a day per place.
"""
import threading
import time
from datetime import date, timedelta

import httpx

_lock = threading.Lock()

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
