"""WhatsApp bot over Twilio (stretch). Pure helpers; the route is POST /api/whatsapp in main.py.

A farmer sends a leaf photo and gets the same result as the app, as one text reply:
verdict, the advice steps, blight risk and the Kisan Call Centre number. Text commands
set the crop and language; sharing a location turns on the weather risk.

All reply text comes from the app's i18n files (frontend/src/i18n/{lang}.json, keys wa.*,
label.*, result.*, risk.*, soil.*, quality.*), so the translations are written once.
"""
import base64
import hashlib
import hmac
import json
import re
from pathlib import Path
from xml.sax.saxutils import escape

MAX_REPLY_CHARS = 1500  # WhatsApp allows 1600 per message

CROP_WORDS = {
    "tomato": "tomato", "टमाटर": "tomato", "टोमॅटो": "tomato", "tamatar": "tomato",
    "potato": "potato", "आलू": "potato", "बटाटा": "potato", "aloo": "potato", "batata": "potato",
}
LANG_WORDS = {
    "english": "en", "en": "en",
    "hindi": "hi", "हिंदी": "hi", "हिन्दी": "hi", "hi": "hi",
    "marathi": "mr", "मराठी": "mr", "mr": "mr",
}


def load_strings(i18n_dir: Path) -> dict[str, dict[str, str]]:
    out = {}
    for lang in ("en", "hi", "mr"):
        p = i18n_dir / f"{lang}.json"
        if p.exists():
            out[lang] = json.loads(p.read_text(encoding="utf-8"))
    return out


class Text:
    """t(key, **vars) for one language, falling back to English, then to the key."""

    def __init__(self, strings: dict, lang: str):
        self.own, self.en = strings.get(lang, {}), strings.get("en", {})

    def __call__(self, key: str, **kw) -> str:
        s = self.own.get(key) or self.en.get(key) or key
        return re.sub(r"\{\{(\w+)\}\}", lambda m: str(kw.get(m.group(1), m.group(0))), s)


def parse_command(body: str) -> dict:
    """Crop and/or language words in a text message, e.g. 'potato', 'मराठी', 'tomato hindi'."""
    found = {}
    for w in re.findall(r"[\wऀ-ॿ]+", (body or "").lower()):
        if w in CROP_WORDS:
            found["crop"] = CROP_WORDS[w]
        elif w in LANG_WORDS:
            found["lang"] = LANG_WORDS[w]
    return found


def format_result(r: dict, t: Text) -> str:
    v = r["verdict"]
    lines = [f"🌿 {t('app.name')}"]
    if v["status"] == "likely" and v.get("label"):
        key = "result.likely_high" if v.get("confidence") == "high" else "result.likely_medium"
        lines.append(f"*{t(key, disease=t('label.' + v['label']))}*")
    else:
        lines.append(f"*{t('result.' + v['status'])}*")
        if v["status"] == "retake":
            lines.append(t((r.get("quality") or {}).get("reason_key") or "quality.unknown"))
            return "\n".join(lines)
        if v["status"] == "uncertain":
            names = [t("label." + c["label"]) for c in (r.get("classifier") or {}).get("top3", [])[:2]]
            if names:
                lines.append(t("wa.closest", names=", ".join(names)))
    a = r.get("advice") or {}
    if a.get("summary"):
        lines += ["", a["summary"]]
    for i, s in enumerate(a.get("steps", [])[:4], 1):
        lines.append(f"{i}. {s['text']}")
    risk = r["weather_risk"]["level"]
    lines += ["", f"🌦️ {t('risk.title')}: {t('risk.' + risk)}"]
    if risk == "not_assessed":
        lines.append(t("wa.share_location"))
    else:
        lines.append(f"💧 {t('soil.irrigation.' + r['soil']['irrigation_key'])}")
    lines += ["", f"📞 {t('result.call_kcc')}: {r['escalation']['kcc_phone']}", t("result.disclaimer")]
    text = "\n".join(lines)
    return text if len(text) <= MAX_REPLY_CHARS else text[: MAX_REPLY_CHARS - 1] + "…"


def twiml(message: str) -> str:
    return f'<?xml version="1.0" encoding="UTF-8"?><Response><Message>{escape(message)}</Message></Response>'


def valid_signature(auth_token: str, url: str, params: dict, signature: str) -> bool:
    """Twilio's X-Twilio-Signature: base64(HMAC-SHA1(token, url + sorted key+value pairs))."""
    data = url + "".join(k + str(params[k]) for k in sorted(params))
    digest = hmac.new(auth_token.encode(), data.encode("utf-8"), hashlib.sha1).digest()
    return hmac.compare_digest(base64.b64encode(digest).decode(), signature or "")
