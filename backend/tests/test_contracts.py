"""Contract checks (part of `make check`): every team-owned JSON file matches its schema,
and the files agree with each other. Nobody hands off until these pass.

Files checked:
  ml/models/labels.json, model_meta.json, thresholds.json                    (Krisha)
  backend/knowledge_base/advice_pack.json, schemes.json                      (Vedant)
  frontend/src/i18n/{en,hi,mr}.json against frontend/src/i18n/keys.json      (Vedant / Saad)
  backend/tests/fixtures/*.json against the DiagnosisResult schema           (Saad)
"""
import json
from pathlib import Path

import jsonschema
import pytest

BACKEND = Path(__file__).resolve().parents[1]
ROOT = BACKEND.parent
SCHEMAS = BACKEND / "knowledge_base/schemas"
MODELS = ROOT / "ml/models"
I18N = ROOT / "frontend/src/i18n"
LANGS = ["en", "hi", "mr"]


def load(p: Path):
    assert p.exists(), f"missing: {p.relative_to(ROOT)}"
    return json.loads(p.read_text(encoding="utf-8"))


def validate(p: Path, schema_name: str):
    data = load(p)
    schema = load(SCHEMAS / schema_name)
    errs = sorted(jsonschema.Draft202012Validator(schema).iter_errors(data), key=lambda e: list(e.path))
    msgs = [f"/{'/'.join(map(str, e.path))}: {e.message[:200]}" for e in errs[:10]]
    assert not msgs, f"{p.relative_to(ROOT)} does not match {schema_name}:\n" + "\n".join(msgs)
    return data


@pytest.fixture(scope="module")
def labels():
    return validate(MODELS / "labels.json", "labels.schema.json")


@pytest.fixture(scope="module")
def pack():
    return validate(BACKEND / "knowledge_base/advice_pack.json", "advice_pack.schema.json")


@pytest.fixture(scope="module")
def keys():
    return set(load(I18N / "keys.json"))


def test_model_files(labels):
    meta = validate(MODELS / "model_meta.json", "model_meta.schema.json")
    validate(MODELS / "thresholds.json", "thresholds.schema.json")
    assert meta["labels"] == labels, "model_meta.json labels differ from labels.json (order matters)"


def test_schemes():
    validate(BACKEND / "knowledge_base/schemes.json", "schemes.schema.json")


@pytest.mark.parametrize("fixture", sorted((BACKEND / "tests/fixtures").glob("*.json")), ids=lambda p: p.stem)
def test_fixture_matches_schema(fixture):
    validate(fixture, "diagnosis_result.schema.json")


@pytest.mark.parametrize("lang", LANGS)
def test_advice_pack_complete(pack, labels, lang):
    entries = pack[lang]
    missing = (set(labels) | {"uncertain", "unsupported"}) - set(entries)
    assert not missing, f"advice_pack[{lang}] missing: {sorted(missing)}"
    for key, adv in entries.items():
        ids = {c["id"] for c in adv["citations"]}
        for s in adv["steps"]:
            assert not s["citation_id"] or s["citation_id"] in ids, f"advice_pack[{lang}][{key}] cites unknown id {s['citation_id']}"


def test_label_keys_exist(labels, keys):
    missing = [f"label.{l}" for l in labels if f"label.{l}" not in keys]
    assert not missing, f"frontend/src/i18n/keys.json missing {missing}"


@pytest.mark.parametrize("lang", LANGS)
def test_i18n_keys_match(keys, lang):
    tr = validate(I18N / f"{lang}.json", "i18n.schema.json")
    assert not set(tr) - keys, f"{lang}.json extra keys: {sorted(set(tr) - keys)}"
    assert not keys - set(tr), f"{lang}.json missing keys: {sorted(keys - set(tr))}"
