
"""KrushiCare weather, soil and late-blight risk."""

from datetime import datetime, timezone, timedelta
import time
import httpx

URL = "https://api.open-meteo.com/v1/forecast"
_CACHE = {}


def soil_flags(crop, card):
    if crop not in ("tomato", "potato"):
        raise ValueError("Invalid crop")

    if not card:
        return []

    low, high = (
        (6.0, 7.5) if crop == "tomato"
        else (5.0, 7.0)
    )

    flags = []

    checks = [
        ("ph", low, "ph_low", lambda x, y: x < y),
        ("ph", high, "ph_high", lambda x, y: x > y),
        ("n", 280, "n_low", lambda x, y: x < y),
        ("p", 10, "p_low", lambda x, y: x < y),
        ("k", 110, "k_low", lambda x, y: x < y),
        ("oc", 0.5, "oc_low", lambda x, y: x < y),
    ]

    for key, bound, flag, compare in checks:
        value = card.get(key)
        if value is not None and compare(float(value), bound):
            flags.append(flag)

    return flags


def from_forecast(data, crop, soil_card=None, fetched_at=None):
    if crop not in ("tomato", "potato"):
        raise ValueError("Invalid crop")

    hourly = data["hourly"]
    daily = data["daily"]

    dates = daily["time"][:3]
    times = hourly["time"]
    temperatures = hourly["temperature_2m"]
    humidity = hourly["relative_humidity_2m"]

    days = []

    for day in dates:
        indices = [
            i for i, t in enumerate(times)
            if t[:10] == day
        ]

        if not indices or any(
            temperatures[i] is None or humidity[i] is None
            for i in indices
        ):
            raise ValueError("Incomplete weather data")

        favourable = (
            min(temperatures[i] for i in indices) >= 10
            and sum(humidity[i] >= 90 for i in indices) >= 6
        )

        days.append({
            "date": day,
            "favourable": bool(favourable)
        })

    if len(days) != 3:
        raise ValueError("Expected 3 forecast days")

    flags = [day["favourable"] for day in days]

    if (flags[0] and flags[1]) or (flags[1] and flags[2]):
        level = "high"
    elif any(flags):
        level = "medium"
    else:
        level = "low"

    # Find the current local forecast hour
    now_local = (
        datetime.now(timezone.utc)
        + timedelta(seconds=data.get("utc_offset_seconds", 0))
    ).replace(tzinfo=None)

    current_idx = max(
        (
            i for i, t in enumerate(times)
            if datetime.fromisoformat(t) <= now_local
        ),
        default=0
    )

    moisture_raw = hourly["soil_moisture_3_to_9cm"][current_idx]
    temp_raw = hourly["soil_temperature_6cm"][current_idx]

    moisture = (
        round(float(moisture_raw), 2)
        if moisture_raw is not None else None
    )
    soil_temp = (
        round(float(temp_raw), 1)
        if temp_raw is not None else None
    )

    rain = daily["precipitation_sum"][:2]

    if len(rain) != 2 or any(x is None for x in rain):
        irrigation = "unknown"
    elif sum(rain) >= 5:
        irrigation = "wait_for_rain"
    elif moisture_raw is None:
        irrigation = "unknown"
    elif float(moisture_raw) < 0.15:
        irrigation = "consider_irrigating"
    else:
        irrigation = "no_action"

    return {
        "weather_risk": {
            "level": level,
            "rule": "hutton",
            "days": days,
            "source": "open-meteo",
            "fetched_at": fetched_at or datetime.now(
                timezone.utc
            ).isoformat(timespec="seconds")
        },
        "soil": {
            "moisture": moisture,
            "temperature_c": soil_temp,
            "irrigation_key": irrigation,
            "card_values": (
                dict(soil_card)
                if soil_card is not None else None
            ),
            "flags": soil_flags(crop, soil_card)
        }
    }


def get_context(
    lat: float,
    lon: float,
    crop: str,
    soil_card: dict | None = None
) -> dict:

    key = (
        round(float(lat), 2),
        round(float(lon), 2),
        datetime.now(timezone.utc).date().isoformat()
    )

    now = time.monotonic()

    if key not in _CACHE or now - _CACHE[key][0] > 3600:
        params = {
            "latitude": key[0],
            "longitude": key[1],
            "hourly": (
                "temperature_2m,relative_humidity_2m,"
                "soil_moisture_3_to_9cm,soil_temperature_6cm"
            ),
            "daily": "precipitation_sum",
            "forecast_days": 3,
            "timezone": "auto"
        }

        response = httpx.get(
            URL, params=params, timeout=6.0
        )
        response.raise_for_status()
        data = response.json()

        if data.get("error"):
            raise ValueError(
                data.get("reason", "Weather API error")
            )

        fetched_at = datetime.now(
            timezone.utc
        ).isoformat(timespec="seconds")

        _CACHE[key] = (now, data, fetched_at)

    _, data, fetched_at = _CACHE[key]

    return from_forecast(
        data, crop, soil_card, fetched_at
    )
