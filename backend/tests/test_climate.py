"""Climate card rules (services/climate.py), offline."""
import json
from datetime import date, timedelta
from pathlib import Path

import jsonschema
import pytest

from services import climate as ctx

CLIMATE_SCHEMA = json.loads((Path(__file__).resolve().parents[1] / "knowledge_base/schemas/climate.schema.json").read_text())


@pytest.mark.parametrize("today,season,start,end", [
    (date(2026, 10, 29), "rabi", "2026-10-01", "2026-10-23"),
    (date(2026, 10, 5), "kharif", "2026-06-01", "2026-09-29"),   # under a week of rabi data -> previous season
    (date(2027, 1, 20), "rabi", "2026-10-01", "2027-01-14"),     # rabi crosses the new year
    (date(2026, 7, 15), "kharif", "2026-06-01", "2026-07-09"),
    (date(2026, 4, 2), "zaid", "2026-03-01", "2026-03-27"),
])
def test_season_window(today, season, start, end):
    s, a, b = ctx.season_window(today)
    assert (s, a.isoformat(), b.isoformat()) == (season, start, end)


def daily(start: date, end: date, rain_fn, temp_fn):
    out = {"time": [], "precipitation_sum": [], "temperature_2m_mean": []}
    d = start
    while d <= end:
        out["time"].append(d.isoformat())
        out["precipitation_sum"].append(rain_fn(d))
        out["temperature_2m_mean"].append(temp_fn(d))
        d += timedelta(days=1)
    return {"daily": out}


def test_climate_summary_rabi_across_new_year():
    start, end = date(2026, 10, 1), date(2027, 1, 14)
    current = daily(start, end, lambda d: 1.0, lambda d: 22.0)  # 106 days x 1 mm
    normal = daily(date(1991, 10, 1), date(2021, 6, 30), lambda d: 2.0, lambda d: 21.0)
    out = ctx.climate_summary("rabi", start, end, current, normal)
    jsonschema.validate(out, CLIMATE_SCHEMA)
    assert out["rain_mm"] == 106.0 and out["normal_rain_mm"] == 212.0 and out["rain_pct_of_normal"] == 50
    assert out["temp_anomaly_c"] == 1.0


def test_climate_summary_rejects_gappy_data():
    start, end = date(2026, 10, 1), date(2026, 10, 23)
    current = daily(start, date(2026, 10, 10), lambda d: 0, lambda d: 25)  # half the window missing
    normal = daily(date(1991, 10, 1), date(2021, 6, 30), lambda d: 2.0, lambda d: 21.0)
    with pytest.raises(ValueError):
        ctx.climate_summary("rabi", start, end, current, normal)


def test_dry_normal_gives_null_pct():
    start, end = date(2026, 3, 1), date(2026, 3, 27)
    current = daily(start, end, lambda d: 0, lambda d: 30)
    normal = daily(date(1991, 3, 1), date(2021, 6, 30), lambda d: 0, lambda d: 29)
    assert ctx.climate_summary("zaid", start, end, current, normal)["rain_pct_of_normal"] is None


def test_get_climate_caches_per_place(monkeypatch):
    calls = []

    def fake_archive(lat, lon, start, end):
        calls.append(start)
        s, e = date.fromisoformat(start), date.fromisoformat(end)
        return daily(s, e, lambda d: 2.0, lambda d: 25.0)

    monkeypatch.setattr(ctx, "fetch_archive", fake_archive)
    monkeypatch.setattr(ctx, "_climate_cache", {})
    a = ctx.get_climate(18.52, 73.86)
    b = ctx.get_climate(18.53, 73.86)  # same 0.1-degree cell
    assert a == b and len(calls) == 2
    jsonschema.validate(a, CLIMATE_SCHEMA)
