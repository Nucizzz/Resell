import os, httpx
UPC_KEY=os.getenv("UPCITEMDB_KEY","").strip()

async def upcitemdb_lookup(barcode:str):
    if not UPC_KEY:
        return None
    url=f"https://api.upcitemdb.com/prod/trial/lookup?upc={barcode}"
    async with httpx.AsyncClient(timeout=8) as c:
        r=await c.get(url, headers={"user_key": UPC_KEY})
        if r.status_code!=200: return None
        data=r.json()
        items=data.get("items") or []
        if not items: return None
        it=items[0]
        return {
            "title": it.get("title"),
            "brand": it.get("brand"),
            "category": it.get("category"),
            "image_url": (it.get("images") or [None])[0],
            "description": it.get("description"),
            "sku": it.get("model")
        }

async def wikidata_lookup(barcode:str):
    query=f"""SELECT ?item ?itemLabel ?brandLabel ?image WHERE {{
      ?item wdt:P396 '{barcode}' .
      OPTIONAL {{ ?item wdt:P176 ?brand . }}
      OPTIONAL {{ ?item wdt:P18 ?image . }}
      SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en,it". }}
    }} LIMIT 1"""
    async with httpx.AsyncClient(timeout=10) as c:
        r=await c.get("https://query.wikidata.org/sparql", params={"format":"json","query":query})
        if r.status_code!=200: return None
        b=(r.json().get("results",{}).get("bindings") or [])
        if not b: return None
        row=b[0]
        return {
            "title": row.get("itemLabel",{}).get("value"),
            "brand": row.get("brandLabel",{}).get("value"),
            "image_url": row.get("image",{}).get("value"),
        }

async def enrich_barcode(barcode:str):
    for fn in (upcitemdb_lookup, wikidata_lookup):
        try:
            got=await fn(barcode)
            if got: return got
        except Exception:
            pass
    return None
