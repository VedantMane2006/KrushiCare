
from datetime import date, timedelta

from services import context


def test_context_shape(monkeypatch):
    today = date.today()

    dates = [
        (today + timedelta(days=i)).isoformat()
        for i in range(3)
    ]

    hourly_times = [
        f"{day}T{hour:02d}:00"
        for day in dates
        for hour in range(24)
    ]

    fake_forecast = {
        "utc_offset_seconds": 0,
        "hourly": {
            "time": hourly_times,
            "temperature_2m": [15] * 72,
            "relative_humidity_2m": [95] * 72,
            "soil_moisture_3_to_9cm": [0.21] * 72,
            "soil_temperature_6cm": [24.5] * 72,
        },
        "daily": {
            "time": dates,
            "precipitation_sum": [6, 0, 0],
        },
    }

    class FakeResponse:
        def raise_for_status(self):
            pass

        def json(self):
            return fake_forecast

    monkeypatch.setattr(
        context.httpx,
        "get",
        lambda *args, **kwargs: FakeResponse()
    )

    context._CACHE.clear()

    out = context.get_context(
        18.52, 73.86, "tomato"
    )

    assert set(out) == {"weather_risk", "soil"}
    assert len(out["weather_risk"]["days"]) == 3
    assert out["weather_risk"]["level"] == "high"
    assert out["soil"]["moisture"] == 0.21
    assert out["soil"]["irrigation_key"] == "wait_for_rain"
