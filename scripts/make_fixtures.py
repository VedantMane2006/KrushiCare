"""Regenerate shared/fixtures/*.json from the verdict rules and the current advice pack.

    python scripts/make_fixtures.py
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))
from app.verdict import DEFAULT_THRESHOLDS, NOT_ASSESSED_CONTEXT, build_result, decide, pick_advice  # noqa: E402

pack = json.loads((ROOT / "content/advice_pack.json").read_text())
GOOD_Q = {"ok": True, "blur": 182.4, "brightness": 0.52, "leaf_ratio": 0.61, "reason_key": None}
CTX = {
    "weather_risk": {"level": "high", "rule": "hutton", "source": "open-meteo", "fetched_at": "2026-10-29T10:00:05+00:00",
                     "days": [{"date": "2026-10-30", "favourable": True}, {"date": "2026-10-31", "favourable": True},
                              {"date": "2026-11-01", "favourable": False}]},
    "soil": {"moisture": 0.21, "temperature_c": 24.5, "irrigation_key": "wait_for_rain", "card_values": None, "flags": []},
}


def clf(*pairs):
    return {"model_version": "v1", "top3": [{"label": l, "prob": p} for l, p in pairs],
            "margin": round(pairs[0][1] - pairs[1][1], 4)}


cases = {
    "likely_high": ("tomato", GOOD_Q, clf(("tomato__late_blight", 0.81), ("tomato__early_blight", 0.19), ("potato__late_blight", 0.0)), CTX),
    "likely_medium": ("potato", GOOD_Q, clf(("potato__early_blight", 0.62), ("potato__late_blight", 0.31), ("potato__healthy", 0.05)), CTX),
    "uncertain": ("tomato", GOOD_Q, clf(("tomato__septoria_leaf_spot", 0.46), ("tomato__bacterial_spot", 0.38), ("tomato__target_spot", 0.09)), CTX),
    "retake": ("tomato", {"ok": False, "blur": 31.0, "brightness": 0.48, "leaf_ratio": 0.55, "reason_key": "quality.too_blurry"}, None, CTX),
    "unsupported": ("tomato", {"ok": True, "blur": 210.0, "brightness": 0.6, "leaf_ratio": 0.22, "reason_key": None},
                    clf(("tomato__healthy", 0.31), ("potato__healthy", 0.22), ("tomato__leaf_mold", 0.12)), CTX),
    "weather_not_assessed": ("tomato", GOOD_Q, clf(("tomato__early_blight", 0.88), ("tomato__target_spot", 0.06), ("tomato__healthy", 0.03)),
                             NOT_ASSESSED_CONTEXT),
}

out = ROOT / "shared/fixtures"
out.mkdir(parents=True, exist_ok=True)
for i, (name, (crop, q, c, ctx)) in enumerate(cases.items()):
    v = decide(c, q, crop, DEFAULT_THRESHOLDS)
    r = build_result(client_id=f"00000000-0000-4000-8000-00000000000{i + 1}", crop=crop, lang="en",
                     captured_at="2026-10-29T10:00:00Z", quality=q, classifier=c, verdict=v, context=ctx,
                     advice=pick_advice(pack, "en", v))
    (out / f"{name}.json").write_text(json.dumps(r, indent=2, ensure_ascii=False) + "\n")
    print(name, v)
