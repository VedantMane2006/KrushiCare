# Rule spec for services/context.py (Saad → Krisha)

`get_context(lat, lon, crop, soil_card=None) -> {"weather_risk": {...}, "soil": {...}}` in the exact DiagnosisResult shape (see `shared/schemas/diagnosis_result.schema.json` and `shared/fixtures/likely_high.json`). Must return within 8 s (the backend times out and falls back to `not_assessed`); raise on any failure, the backend handles it. Use `httpx` with a 6 s timeout, and cache by (lat, lon rounded to 2 decimals, date) for 1 hour.

## Data: one Open-Meteo call

`https://api.open-meteo.com/v1/forecast?latitude=..&longitude=..&hourly=temperature_2m,relative_humidity_2m,soil_moisture_3_to_9cm,soil_temperature_6cm&daily=precipitation_sum&forecast_days=3&timezone=auto`

## Late blight risk (Hutton criteria, same rule for tomato and potato)

- A day is **favourable** when its minimum hourly `temperature_2m` ≥ 10 °C **and** it has ≥ 6 hours with `relative_humidity_2m` ≥ 90 %.
- `days`: the 3 forecast days `[{date: "YYYY-MM-DD", favourable: bool}]`.
- `level`: `high` if there are 2 consecutive favourable days (a Hutton period); `medium` if exactly one or two non-consecutive favourable days; `low` if none.
- `rule: "hutton"`, `source: "open-meteo"`, `fetched_at`: UTC ISO time of the call.

## Soil and irrigation hint

- `moisture`: current-hour `soil_moisture_3_to_9cm` (m³/m³, 0–1), rounded to 2 decimals. `temperature_c`: current-hour `soil_temperature_6cm`, 1 decimal.
- `irrigation_key`, first match wins:
  1. total `precipitation_sum` over the next 2 days ≥ 5 mm → `wait_for_rain`
  2. moisture < 0.15 → `consider_irrigating`
  3. moisture available → `no_action`
  4. otherwise `unknown`

## Soil Health Card checks (optional input)

`soil_card` = `{ph, n, p, k, oc}` (any may be missing or null; N/P/K in kg/ha, OC in %). Echo it back as `card_values` (or `null` if not given). Add flag strings (the app shows `soil.flag.<flag>`):

| Flag | Tomato | Potato |
|---|---|---|
| `ph_low` | pH < 6.0 | pH < 5.0 |
| `ph_high` | pH > 7.5 | pH > 7.0 |
| `n_low` | N < 280 | N < 280 |
| `p_low` | P < 10 | P < 10 |
| `k_low` | K < 110 | K < 110 |
| `oc_low` | OC < 0.5 | OC < 0.5 |

N/P/K/OC cut-offs are the Soil Health Card "low" bands; pH ranges are the usual crop optima.

## Tests (services/tests)

Unit-test the rule functions on canned Open-Meteo JSON (no network in tests): a Hutton period → `high`; one favourable day → `medium`; dry warm week → `low` with `consider_irrigating`; rain ≥ 5 mm → `wait_for_rain`; each soil flag at its boundary.

## Stretch: get_climate(lat, lon)

`{"season_rain_mm", "normal_rain_mm", "season_temp_c", "normal_temp_c", "period": "2026-06-01/2026-10-29"}` from the Open-Meteo archive API (this season) vs the climate API 1991–2020 mean for the same dates.
