"""make check: validate every shared/content/ML JSON file, cross-check labels and keys, run all tests.

Exit code is non-zero on any failure. Nobody hands off until this is green.
"""
import json
import subprocess
import sys
from pathlib import Path

import jsonschema

ROOT = Path(__file__).resolve().parents[1]
SCHEMAS = ROOT / "shared/schemas"
LANGS = ["en", "hi", "mr"]
errors: list[str] = []


def load(rel):
    p = ROOT / rel
    if not p.exists():
        errors.append(f"missing: {rel}")
        return None
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        errors.append(f"{rel}: invalid JSON ({e})")
        return None


def validate(rel, schema_name):
    data = load(rel)
    if data is None:
        return None
    schema = json.loads((SCHEMAS / schema_name).read_text())
    v = jsonschema.Draft202012Validator(schema)
    for e in sorted(v.iter_errors(data), key=lambda e: list(e.path))[:10]:
        errors.append(f"{rel} at /{'/'.join(map(str, e.path))}: {e.message[:200]}")
    return data


labels = validate("shared/labels.json", "labels.schema.json") or []
meta = validate("ml/export/model_meta.json", "model_meta.schema.json")
validate("ml/export/thresholds.json", "thresholds.schema.json")
pack = validate("content/advice_pack.json", "advice_pack.schema.json") or {}
validate("content/schemes.json", "schemes.schema.json")
for f in sorted((ROOT / "shared/fixtures").glob("*.json")):
    validate(str(f.relative_to(ROOT)), "diagnosis_result.schema.json")

# model_meta labels must equal labels.json, in order.
if meta and labels and meta.get("labels") != labels:
    errors.append("ml/export/model_meta.json labels differ from shared/labels.json (order matters)")

# Every label + uncertain + unsupported in every language; every citation_id resolves.
needed = set(labels) | {"uncertain", "unsupported"}
for lang in LANGS:
    entries = pack.get(lang, {})
    missing = needed - set(entries)
    if missing:
        errors.append(f"advice_pack[{lang}] missing: {', '.join(sorted(missing))}")
    for key, adv in entries.items():
        ids = {c["id"] for c in adv.get("citations", [])}
        for s in adv.get("steps", []):
            if s.get("citation_id") and s["citation_id"] not in ids:
                errors.append(f"advice_pack[{lang}][{key}] step cites unknown id {s['citation_id']}")

# i18n files have exactly the keys in i18n_keys.json, and a label.* key for every label.
keys = set((load("shared/i18n_keys.json") or {}).keys())
for lab in labels:
    if f"label.{lab}" not in keys:
        errors.append(f"shared/i18n_keys.json missing label.{lab}")
for lang in LANGS:
    tr = validate(f"content/i18n/{lang}.json", "i18n.schema.json")
    if tr is None:
        continue
    if set(tr) - keys:
        errors.append(f"content/i18n/{lang}.json extra keys: {', '.join(sorted(set(tr) - keys))[:300]}")
    if keys - set(tr):
        errors.append(f"content/i18n/{lang}.json missing keys: {', '.join(sorted(keys - set(tr)))[:300]}")

if errors:
    print("JSON checks FAILED:")
    for e in errors:
        print("  -", e)
else:
    print("JSON checks passed.")

tests = subprocess.run([sys.executable, "-m", "pytest"], cwd=ROOT)
sys.exit(1 if errors or tests.returncode else 0)
