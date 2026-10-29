"""Fallback fakes with the teammates' signatures. Used when USE_FAKES=1 or a real module fails to import."""
from datetime import date, timedelta


def predict(image):
    return {"model_version": "fake", "top3": [{"label": "tomato__early_blight", "prob": 0.74},
            {"label": "tomato__septoria_leaf_spot", "prob": 0.16}, {"label": "tomato__healthy", "prob": 0.05}], "margin": 0.58}


def check(image):
    return {"ok": True, "blur": 150.0, "brightness": 0.5, "leaf_ratio": 0.6, "reason_key": None}


def get_context(lat, lon, crop, soil_card=None):
    days = [{"date": (date.today() + timedelta(days=i)).isoformat(), "favourable": i == 0} for i in range(3)]
    return {"weather_risk": {"level": "medium", "rule": "hutton", "days": days, "source": "fake", "fetched_at": None},
            "soil": {"moisture": 0.3, "temperature_c": 22.0, "irrigation_key": "no_action", "card_values": soil_card, "flags": []}}
