from backend.app.services.lookup import _map_rapid


def test_map_rapid_with_products_array():
    payload = {
        "products": [
            {
                "title": "Sample Item",
                "brand": "Acme",
                "category": "Snacks",
                "description": "Crunchy snack",
                "image": "https://example.com/snack.jpg",
            }
        ]
    }
    result = _map_rapid(payload, "0123456789012")
    assert result is not None
    assert result.title == "Sample Item"
    assert result.brand == "Acme"
    assert result.categories == ["Snacks"]
    assert result.image and result.image.url.endswith(".jpg")
    assert result.source == "RAPID"


def test_map_rapid_returns_none_for_empty():
    payload = {"products": []}
    result = _map_rapid(payload, "0123456789012")
    assert result is None
