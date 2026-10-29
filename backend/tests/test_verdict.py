from app.verdict import DEFAULT_THRESHOLDS as T, decide, pick_advice

OK = {"ok": True}


def c(p1, p2, l1="tomato__late_blight"):
    return {"top3": [{"label": l1, "prob": p1}, {"label": "tomato__early_blight", "prob": p2}], "margin": p1 - p2}


def test_boundaries():
    assert decide(c(0.70, 0.40), OK, "tomato", T)["confidence"] == "high"  # exactly at both thresholds
    assert decide(c(0.50, 0.45), OK, "tomato", T) == {"status": "likely", "label": "tomato__late_blight", "confidence": "medium"}
    assert decide(c(0.45, 0.40), OK, "tomato", T)["status"] == "uncertain"
    assert decide(c(0.4499, 0.40), OK, "tomato", T)["status"] == "unsupported"


def test_quality_fail_and_missing_classifier():
    assert decide(None, {"ok": False}, "tomato", T)["status"] == "retake"


def test_advice_fallback_to_en():
    pack = {"en": {"tomato__late_blight": {"summary": "en"}, "uncertain": {"summary": "u"}}, "hi": {}}
    assert pick_advice(pack, "hi", {"status": "likely", "label": "tomato__late_blight"})["summary"] == "en"
    assert pick_advice(pack, "hi", {"status": "retake", "label": None})["summary"] == "u"
