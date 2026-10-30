"""WhatsApp bot (Twilio webhook): commands, reply text, signature check and the photo flow."""
import base64
import hashlib
import hmac

from services import whatsapp as wa

from .conftest import classifier, jpeg_bytes

STRINGS = {"en": {"app.name": "AgriSense", "result.likely_high": "This looks like {{disease}}",
                  "label.tomato__late_blight": "Tomato late blight", "risk.title": "Blight risk",
                  "risk.medium": "Medium", "soil.irrigation.no_action": "Fine", "result.call_kcc": "Call KCC",
                  "result.disclaimer": "A guide, not a lab test.", "wa.help": "Crop now: {{crop}}"},
           "hi": {"wa.help": "फसल: {{crop}}"}}


def test_parse_command():
    assert wa.parse_command("potato") == {"crop": "potato"}
    assert wa.parse_command("Tomato, Hindi please") == {"crop": "tomato", "lang": "hi"}
    assert wa.parse_command("मराठी") == {"lang": "mr"}
    assert wa.parse_command("बटाटा") == {"crop": "potato"}
    assert wa.parse_command("hello there") == {}
    assert wa.parse_command("hi") == {}  # a greeting, not Hindi


def test_text_falls_back_to_english_then_key():
    t = wa.Text(STRINGS, "hi")
    assert t("wa.help", crop="x") == "फसल: x"
    assert t("app.name") == "AgriSense"
    assert t("no.such.key") == "no.such.key"


def test_format_result_likely():
    r = {"verdict": {"status": "likely", "label": "tomato__late_blight", "confidence": "high"},
         "advice": {"summary": "Act fast.", "steps": [{"text": "Remove leaves."}]},
         "weather_risk": {"level": "medium"}, "soil": {"irrigation_key": "no_action"},
         "escalation": {"kcc_phone": "1800-180-1551"}}
    text = wa.format_result(r, wa.Text(STRINGS, "en"))
    assert "*This looks like Tomato late blight*" in text
    assert "1. Remove leaves." in text and "Blight risk: Medium" in text and "1800-180-1551" in text
    assert len(text) <= wa.MAX_REPLY_CHARS


def test_twiml_escapes():
    assert "<Message>a &lt;b&gt; &amp; c</Message>" in wa.twiml("a <b> & c")


def test_signature():
    url, params = "https://x.example/api/whatsapp", {"Body": "hi", "From": "whatsapp:+911"}
    data = url + "BodyhiFromwhatsapp:+911"
    sig = base64.b64encode(hmac.new(b"tok", data.encode(), hashlib.sha1).digest()).decode()
    assert wa.valid_signature("tok", url, params, sig)
    assert not wa.valid_signature("tok", url, params, "bad")


def test_webhook_text_then_photo(client, monkeypatch):
    import main
    monkeypatch.delenv("TWILIO_AUTH_TOKEN", raising=False)
    monkeypatch.setattr(main.S, "predict", lambda img: classifier(("potato__late_blight", 0.99999), ("potato__early_blight", 0.0)))

    async def media(url):
        return jpeg_bytes()
    monkeypatch.setattr(main, "_twilio_media", media)

    sender = {"From": "whatsapp:+919999999999"}
    r = client.post("/api/whatsapp", data={**sender, "Body": "hi"})
    assert r.status_code == 200 and r.headers["content-type"].startswith("application/xml")
    assert "<Message>" in r.text

    assert client.post("/api/whatsapp", data={**sender, "Body": "potato"}).status_code == 200
    photo = {**sender, "Body": "", "NumMedia": "1", "MessageSid": "SM123",
             "MediaUrl0": "https://api.twilio.com/media/1", "MediaContentType0": "image/jpeg"}
    first = client.post("/api/whatsapp", data=photo).text
    assert "late blight" in first.lower()
    assert client.post("/api/whatsapp", data=photo).text == first  # Twilio retry: same answer


def test_webhook_rejects_bad_signature(client, monkeypatch):
    monkeypatch.setenv("TWILIO_AUTH_TOKEN", "secret")
    r = client.post("/api/whatsapp", data={"From": "whatsapp:+91", "Body": "hi"}, headers={"X-Twilio-Signature": "nope"})
    assert r.status_code == 403


def test_signed_webhook_replies_through_the_messages_api(client, monkeypatch):
    import main
    url = "https://example.test/api/whatsapp"
    monkeypatch.setenv("TWILIO_AUTH_TOKEN", "tok")
    monkeypatch.setenv("TWILIO_ACCOUNT_SID", "ACtest")
    monkeypatch.setenv("WHATSAPP_WEBHOOK_URL", url)
    sent = []

    async def send(form, body):
        sent.append((form["From"], body))
    monkeypatch.setattr(main, "_twilio_send", send)

    form = {"From": "whatsapp:+918888888888", "To": "whatsapp:+17372508034", "Body": "hi"}
    data = url + "".join(k + form[k] for k in sorted(form))
    sig = base64.b64encode(hmac.new(b"tok", data.encode(), hashlib.sha1).digest()).decode()
    assert client.post("/api/whatsapp", data=form).status_code == 403  # unsigned
    r = client.post("/api/whatsapp", data=form, headers={"X-Twilio-Signature": sig})
    assert r.status_code == 200 and "<Message>" not in r.text
    assert len(sent) == 1 and sent[0][0] == form["From"] and sent[0][1]


def test_send_falls_back_to_a_template_when_twilio_wants_one(monkeypatch):
    import asyncio
    import json

    import httpx
    import main
    monkeypatch.setenv("TWILIO_ACCOUNT_SID", "ACtest")
    monkeypatch.setenv("TWILIO_AUTH_TOKEN", "tok")
    monkeypatch.delenv("TWILIO_CONTENT_SID", raising=False)
    monkeypatch.setattr(main, "_wa_content_sid", None)
    calls = []

    def handler(req):
        calls.append(req)
        if req.url.host == "content.twilio.com":
            return httpx.Response(201, json={"sid": "HXabc"})
        if b"ContentSid" not in req.content:
            return httpx.Response(400, json={"code": 21654, "message": "ContentSid Required"})
        return httpx.Response(201, json={"sid": "SMok"})
    real = httpx.AsyncClient
    monkeypatch.setattr(main.httpx, "AsyncClient", lambda **kw: real(transport=httpx.MockTransport(handler), **kw))

    asyncio.run(main._twilio_send({"From": "whatsapp:+91", "To": "whatsapp:+1"}, "फसल ठीक है"))
    assert [c.url.host for c in calls] == ["api.twilio.com", "content.twilio.com", "api.twilio.com"]
    sent = dict(httpx.QueryParams(calls[-1].content.decode()))
    assert sent["ContentSid"] == "HXabc" and json.loads(sent["ContentVariables"]) == {"1": "फसल ठीक है"}
    assert sent["To"] == "whatsapp:+91"


def _meta_payload(msg):
    return {"object": "whatsapp_business_account", "entry": [{"changes": [{"value": {"messages": [msg]}}]}]}


def test_meta_webhook_verify(client, monkeypatch):
    monkeypatch.setenv("META_VERIFY_TOKEN", "secret-word")
    ok = client.get("/api/whatsapp/meta", params={"hub.mode": "subscribe", "hub.verify_token": "secret-word", "hub.challenge": "42"})
    assert ok.status_code == 200 and ok.text == "42"
    assert client.get("/api/whatsapp/meta", params={"hub.mode": "subscribe", "hub.verify_token": "nope", "hub.challenge": "42"}).status_code == 403


def test_meta_webhook_text_then_photo(client, monkeypatch):
    import json

    import main
    monkeypatch.delenv("META_APP_SECRET", raising=False)
    monkeypatch.setattr(main.S, "predict", lambda img: classifier(("potato__late_blight", 0.99999), ("potato__early_blight", 0.0)))
    sent = []

    async def send(to, body):
        sent.append((to, body))

    async def media(media_id):
        assert media_id == "MEDIA1"
        return jpeg_bytes()
    monkeypatch.setattr(main, "_meta_send", send)
    monkeypatch.setattr(main, "_meta_media", media)

    who = "917700000001"
    assert client.post("/api/whatsapp/meta", json=_meta_payload({"from": who, "id": "w1", "type": "text", "text": {"body": "potato"}})).status_code == 200
    photo = {"from": who, "id": "w2", "type": "image", "image": {"id": "MEDIA1", "mime_type": "image/jpeg"}}
    assert client.post("/api/whatsapp/meta", json=_meta_payload(photo)).status_code == 200
    assert [s[0] for s in sent] == [who, who]
    assert "late blight" in sent[1][1].lower()
    # Delivery receipts (no "messages") are ignored.
    assert client.post("/api/whatsapp/meta", json={"entry": [{"changes": [{"value": {"statuses": [{}]}}]}]}).status_code == 200
    assert len(sent) == 2

    monkeypatch.setenv("META_APP_SECRET", "app-secret")
    body = json.dumps(_meta_payload({"from": who, "id": "w3", "type": "text", "text": {"body": "hi"}})).encode()
    assert client.post("/api/whatsapp/meta", content=body, headers={"Content-Type": "application/json"}).status_code == 403
    sig = "sha256=" + hmac.new(b"app-secret", body, hashlib.sha256).hexdigest()
    ok = client.post("/api/whatsapp/meta", content=body, headers={"Content-Type": "application/json", "X-Hub-Signature-256": sig})
    assert ok.status_code == 200 and len(sent) == 3


def test_telegram_bot_text_then_photo(client, monkeypatch):
    import main
    monkeypatch.delenv("TELEGRAM_SECRET", raising=False)
    monkeypatch.setattr(main.S, "predict", lambda img: classifier(("potato__late_blight", 0.99999), ("potato__early_blight", 0.0)))
    sent = []

    async def send(chat_id, body):
        sent.append((chat_id, body))

    async def media(file_id):
        assert file_id == "BIG"
        return jpeg_bytes()
    monkeypatch.setattr(main, "_telegram_send", send)
    monkeypatch.setattr(main, "_telegram_media", media)

    chat = {"id": 555}
    me = {"id": 777}
    assert client.post("/api/telegram", json={"message": {"message_id": 1, "chat": chat, "from": me, "text": "/start"}}).status_code == 200
    assert client.post("/api/telegram", json={"message": {"message_id": 2, "chat": chat, "from": me, "text": "potato"}}).status_code == 200
    photo = {"message_id": 3, "chat": chat, "from": me, "photo": [{"file_id": "SMALL"}, {"file_id": "BIG"}]}
    assert client.post("/api/telegram", json={"message": photo}).status_code == 200
    assert [s[0] for s in sent] == [555, 555, 555]
    assert "late blight" in sent[2][1].lower()
    assert client.post("/api/telegram", json={"edited_message": {}}).status_code == 200  # ignored
    assert len(sent) == 3

    monkeypatch.setenv("TELEGRAM_SECRET", "s3")
    assert client.post("/api/telegram", json={"message": photo}).status_code == 403
    ok = client.post("/api/telegram", json={"message": photo}, headers={"X-Telegram-Bot-Api-Secret-Token": "s3"})
    assert ok.status_code == 200 and len(sent) == 4


def test_telegram_html_keeps_bold_and_escapes():
    import main
    assert main.telegram_html("*Late blight* <spray> & go") == "<b>Late blight</b> &lt;spray&gt; &amp; go"
