from backend.app.utils.gtin import (
    normalize_gtin_for_lookup,
    parse_gtin,
    to_gtin13_from_gtin14,
    validate_check_digit,
)


def test_parse_and_validate_gtin():
    parsed = parse_gtin("0123456789012")
    assert parsed["type"] == "GTIN13"
    assert parsed["normalized"] == "0123456789012"
    assert validate_check_digit(parsed["normalized"])


def test_gtin14_to_gtin13():
    gtin14 = "10012345678902"
    derived = to_gtin13_from_gtin14(gtin14)
    assert derived == "0012345678902"
    assert validate_check_digit(derived)


def test_normalize_prefers_gtin13():
    gtin14 = "10012345678902"
    normalized = normalize_gtin_for_lookup(gtin14)
    assert normalized == "0012345678902"
