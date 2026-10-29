"""Verdict rules and response building. Pure functions, no I/O except loading JSON."""
import json
from pathlib import Path

CONTRACT_VERSION = 1
KCC_PHONE = "1800-180-1551"

DEFAULT_THRESHOLDS = {
    "unknown_photo": 0.45,
    "likely_high": 0.7,
    "likely_high_margin": 0.3,
    "likely_medium": 0.5,
}

# Tolerance so a value that is exactly on a threshold (0.7 - 0.4 = 0.29999...) counts as reaching it.
EPS = 1e-9

NOT_ASSESSED_CONTEXT = {
    "weather_risk": {"level": "not_assessed", "rule": None, "days": [], "source": None, "fetched_at": None},
    "soil": {"moisture": None, "temperature_c": None, "irrigation_key": "unknown", "card_values": None, "flags": []},
}


def load_thresholds(path: Path) -> dict:
    t = dict(DEFAULT_THRESHOLDS)
    if path.exists():
        t.update(json.loads(path.read_text()))
    return t


def crop_of(label: str) -> str:
    return label.split("__", 1)[0]


def decide(classifier: dict | None, quality: dict | None, crop: str, t: dict) -> dict:
    """Map quality + classifier output to {status, label, confidence}."""
    if quality is not None and not quality["ok"]:
        return {"status": "retake", "label": None, "confidence": None}
    if not classifier or not classifier["top3"]:
        return {"status": "retake", "label": None, "confidence": None}

    top = classifier["top3"][0]
    prob, label, margin = top["prob"], top["label"], classifier["margin"]

    if prob < t["unknown_photo"] - EPS:
        return {"status": "unsupported", "label": None, "confidence": None}
    if crop_of(label) != crop:
        return {"status": "uncertain", "label": label, "confidence": "low"}
    if prob >= t["likely_high"] - EPS and margin >= t["likely_high_margin"] - EPS:
        return {"status": "likely", "label": label, "confidence": "high"}
    if prob >= t["likely_medium"] - EPS:
        return {"status": "likely", "label": label, "confidence": "medium"}
    return {"status": "uncertain", "label": label, "confidence": "low"}


def pick_advice(pack: dict, lang: str, verdict: dict) -> dict:
    """advice_pack[lang][label] for likely, [lang]['uncertain'|'unsupported'] otherwise; fall back to en."""
    if verdict["status"] == "likely":
        key = verdict["label"]
    elif verdict["status"] == "unsupported":
        key = "unsupported"
    else:
        key = "uncertain"
    for lg in (lang, "en"):
        entry = pack.get(lg, {}).get(key)
        if entry:
            return entry
    return {"summary": "", "steps": [], "citations": []}


def build_result(*, client_id: str, crop: str, lang: str, captured_at: str | None,
                 quality: dict | None, classifier: dict | None, verdict: dict,
                 context: dict, advice: dict) -> dict:
    return {
        "contract_version": CONTRACT_VERSION,
        "client_id": client_id,
        "crop": crop,
        "lang": lang,
        "source": "server",
        "captured_at": captured_at,
        "quality": quality,
        "classifier": classifier,
        "verdict": verdict,
        "weather_risk": context["weather_risk"],
        "soil": context["soil"],
        "advice": advice,
        "escalation": {"kcc_phone": KCC_PHONE},
    }
