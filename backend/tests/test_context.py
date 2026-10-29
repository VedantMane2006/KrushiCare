
"""Offline tests for KrushiCare weather and soil rules."""

from datetime import datetime, timedelta

import pytest

from services.context import from_forecast, soil_flags


def sample_forecast(
    favourable=(True, True, False),
    rain=(0, 0, 0),
    moisture=0.13,
):
    start = datetime(2026, 10, 30)

    times = [
        (start + timedelta(hours=i)).isoformat(
            timespec="minutes"
        )
        for i in range(72)
    ]

    humidity = []

    for good_day in favourable:
        humidity.extend(
            ([95] * 6 + [70] * 18)
            if good_day else [70] * 24
        )

    return {
        "utc_offset_seconds": 19800,
        "hourly": {
            "time": times,
            "temperature_2m": [15] * 72,
            "relative_humidity_2m": humidity,
            "soil_moisture_3_to_9cm": [moisture] * 72,
            "soil_temperature_6cm": [24] * 72,
        },
        "daily": {
            "time": [
                "2026-10-30",
                "2026-10-31",
                "2026-11-01",
            ],
            "precipitation_sum": list(rain),
        },
    }


def test_high_blight_risk():
    result = from_forecast(
        sample_forecast((True, True, False)),
        "tomato",
    )
    assert result["weather_risk"]["level"] == "high"


def test_medium_blight_risk():
    result = from_forecast(
        sample_forecast((True, False, True)),
        "potato",
    )
    assert result["weather_risk"]["level"] == "medium"


def test_low_blight_risk():
    result = from_forecast(
        sample_forecast((False, False, False)),
        "tomato",
    )
    assert result["weather_risk"]["level"] == "low"


def test_dry_soil():
    result = from_forecast(
        sample_forecast(
            favourable=(False, False, False),
            moisture=0.10,
        ),
        "tomato",
    )
    assert result["soil"]["irrigation_key"] == (
        "consider_irrigating"
    )


def test_wait_for_rain():
    result = from_forecast(
        sample_forecast(rain=(3, 3, 0)),
        "potato",
    )
    assert result["soil"]["irrigation_key"] == (
        "wait_for_rain"
    )


def test_normal_soil():
    result = from_forecast(
        sample_forecast(moisture=0.21),
        "tomato",
    )
    assert result["soil"]["irrigation_key"] == (
        "no_action"
    )


def test_soil_card_flags():
    result = soil_flags("tomato", {
        "ph": 5.5,
        "n": 270,
        "p": 8,
        "k": 100,
        "oc": 0.4,
    })

    assert set(result) == {
        "ph_low",
        "n_low",
        "p_low",
        "k_low",
        "oc_low",
    }


def test_ph_boundaries():
    assert soil_flags("tomato", {"ph": 6.0}) == []
    assert soil_flags("tomato", {"ph": 7.5}) == []
    assert soil_flags("potato", {"ph": 5.0}) == []
    assert soil_flags("potato", {"ph": 7.0}) == []


def test_invalid_crop():
    with pytest.raises(ValueError):
        soil_flags("apple", {"ph": 6.0})


def test_incomplete_weather():
    data = sample_forecast()
    data["hourly"]["temperature_2m"][0] = None

    with pytest.raises(ValueError):
        from_forecast(data, "tomato")
