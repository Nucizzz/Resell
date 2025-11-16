from __future__ import annotations

from typing import Literal, Optional, TypedDict

GTINType = Literal["GTIN8", "GTIN12", "GTIN13", "GTIN14", "INVALID"]


class ParsedGTIN(TypedDict):
    type: GTINType
    normalized: Optional[str]


def _digits_only(value: str) -> str:
    return "".join(ch for ch in (value or "") if ch.isdigit())


def parse_gtin(raw: str) -> ParsedGTIN:
    digits = _digits_only(raw)
    length = len(digits)
    if length == 8:
        return {"type": "GTIN8", "normalized": digits}
    if length == 12:
        return {"type": "GTIN12", "normalized": digits}
    if length == 13:
        return {"type": "GTIN13", "normalized": digits}
    if length == 14:
        return {"type": "GTIN14", "normalized": digits}
    return {"type": "INVALID", "normalized": None}


def validate_check_digit(gtin: str) -> bool:
    if not gtin or not gtin.isdigit() or len(gtin) < 8:
        return False
    digits = [int(d) for d in gtin]
    check_digit = digits.pop()
    weight = 3
    total = 0
    while digits:
        total += digits.pop() * weight
        weight = 1 if weight == 3 else 3
    calc = (10 - (total % 10)) % 10
    return calc == check_digit


def to_gtin13_from_gtin14(gtin14: str) -> Optional[str]:
    if len(gtin14) != 14 or not gtin14.isdigit():
        return None
    candidate = gtin14[1:]
    return candidate if validate_check_digit(candidate) else None


def normalize_gtin_for_lookup(value: str) -> str:
    parsed = parse_gtin(value)
    normalized = parsed["normalized"]
    if not normalized:
        raise ValueError("Invalid GTIN")
    if not validate_check_digit(normalized):
        raise ValueError("Invalid GTIN check digit")
    if parsed["type"] == "GTIN14":
        derived = to_gtin13_from_gtin14(normalized)
        if derived:
            return derived
    return normalized

