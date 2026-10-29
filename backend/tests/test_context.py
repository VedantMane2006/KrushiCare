"""Rule tests for services/context.py on canned Open-Meteo JSON (no network)."""
import json
from pathlib import Path

import jsonschema
import pytest

from services import context as ctx

SCHEMA = json.loads((Path(__file__).resolve().parents[1] / "knowledge_base/schemas/diagnosis_result.schema.json").read_text())
DAYS = ["2026-10-30", "2026-10-31", "2026-11-01"]


def forecast(day_specs, rain=(0, 0, 0), moisture=0.25, soil_t=22.0):
    """day_specs: per day (min_temp, humid_hours)."""
    times, temps, rhs = [], [], []
    for d, (tmin, humid) in zip(DAYS, day_specs):
        for h in range(24):
            times.append(f"{d}T{h:02d}:00")
            temps.append(tmin if h == 5 else tmin + 8)
            rhs.append(95 if h < humid else 60)
    n = len(times)
    return {
        "utc_offset_seconds": 19800,
        "hourly": {"time": times, "temperature_2m": temps, "relative_humidity_2m": rhs,
                   "soil_moisture_3_to_9cm": [moisture] * n, "soil_temperature_6cm": [soil_t] * n},
        "daily": {"time": DAYS, "precipitation_sum": list(rain)},
    }


@pytest.mark.parametrize("specs,level,fav", [
    ([(12, 8), (11, 7), (5, 10)], "high", [True, True, False]),     # Hutton period
    ([(12, 8), (5, 10), (12, 8)], "medium", [True, False, True]),   # not consecutive
    ([(12, 5), (11, 3), (12, 0)], "low", [False, False, False]),          # not humid enough
    ([(9.9, 12), (15, 8), (8, 9)], "medium", [False, True, False]), # min temp just below 10
    ([(10, 6), (10, 6), (20, 2)], "high", [True, True, False]),     # exactly on both limits
])
def test_blight_risk(specs, level, fav):
    data = forecast(specs)
    days = ctx.blight_days(data)
    assert [d["favourable"] for d in days] == fav
    assert ctx.risk_level(days) == level


def test_irrigation():
    assert ctx.irrigation_key(forecast([(12, 0)] * 3, rain=(3, 2.5, 0)), 0.1) == "wait_for_rain"
    assert ctx.irrigation_key(forecast([(12, 0)] * 3, rain=(1, 0, 20)), 0.1) == "consider_irrigating"  # day 3 rain doesn't count
    assert ctx.irrigation_key(forecast([(12, 0)] * 3), 0.2) == "no_action"
    assert ctx.irrigation_key(forecast([(12, 0)] * 3), None) == "unknown"


@pytest.mark.parametrize("crop,card,flags", [
    ("tomato", {"ph": 5.9, "n": 279, "p": 9.9, "k": 109, "oc": 0.49}, ["ph_low", "n_low", "p_low", "k_low", "oc_low"]),
    ("tomato", {"ph": 6.0, "n": 280, "p": 10, "k": 110, "oc": 0.5}, []),
    ("tomato", {"ph": 7.6}, ["ph_high"]),
    ("potato", {"ph": 5.5}, []),
    ("potato", {"ph": 7.1, "n": None}, ["ph_high"]),
    ("potato", None, []),
])
def test_soil_flags(crop, card, flags):
    assert ctx.soil_flags(crop, card) == flags


def test_get_context_shape_and_cache(monkeypatch):
    calls = []

    def fake_fetch(lat, lon):
        calls.append((lat, lon))
        return forecast([(12, 8), (11, 7), (5, 0)], rain=(0, 1, 0), moisture=0.12, soil_t=24.46)

    ctx._cache.clear()
    monkeypatch.setattr(ctx, "fetch_forecast", fake_fetch)
    out = ctx.get_context(18.5204, 73.8567, "tomato", {"ph": 6.5, "n": 200})
    ctx.get_context(18.5199, 73.8601, "tomato")  # same 2-decimal cell -> cached
    assert len(calls) == 1
    assert out["weather_risk"]["level"] == "high" and out["weather_risk"]["source"] == "open-meteo"
    assert out["soil"] == {"moisture": 0.12, "temperature_c": 24.5, "irrigation_key": "consider_irrigating",
                           "card_values": {"ph": 6.5, "n": 200}, "flags": ["n_low"]}
    # It must slot into a DiagnosisResult.
    sub = {"type": "object", "properties": {k: SCHEMA["properties"][k] for k in ("weather_risk", "soil")}, "$defs": SCHEMA["$defs"]}
    jsonschema.validate(out, sub)


def test_network_errors_propagate(monkeypatch):
    def boom(lat, lon):
        raise ConnectionError("down")
    ctx._cache.clear()
    monkeypatch.setattr(ctx, "fetch_forecast", boom)
    with pytest.raises(ConnectionError):
        ctx.get_context(1.0, 1.0, "potato")
