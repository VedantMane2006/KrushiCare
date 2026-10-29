from services.context import get_context


def test_context_shape():
    out = get_context(18.52, 73.86, "tomato")
    assert set(out) == {"weather_risk", "soil"}
    assert len(out["weather_risk"]["days"]) == 3
