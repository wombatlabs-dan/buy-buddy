#!/usr/bin/env python3
"""Parse saved Facebook Marketplace search HTML (from the logged-in browser on Puget).

Input: data/raw/fb-html/*.txt (JSON with a "content" field, or raw HTML)
Output: data/raw/facebook.json — each record keeps its live listing URL (ADR-006).
"""
import glob
import html
import json
import os
import re

HERE = os.path.dirname(__file__)
IN_DIR = os.path.join(HERE, "..", "raw", "fb-html")
OUT = os.path.join(HERE, "..", "raw", "facebook.json")


def parse(content, query):
    recs = []
    # Each listing card is an <a> whose href points at /marketplace/item/<id>/
    for m in re.finditer(r'<a [^>]*href="(/marketplace/item/(\d+)/[^"]*)"[^>]*>(.*?)</a>', content, re.S):
        item_id, inner = m.group(2), m.group(3)
        tokens = [html.unescape(t).strip() for t in re.split(r"<[^>]+>", inner)]
        tokens = [t for t in tokens if t and t not in ("Just listed", "Partner listing")]
        prices = [t for t in tokens if re.match(r"^(\$[\d,]+|Free)$", t)]
        rest = [t for t in tokens if t not in prices]
        img = re.search(r'<img[^>]+src="([^"]+)"', inner)
        if not rest:
            continue
        price = prices[0] if prices else None
        recs.append({
            "source": "Facebook Marketplace",
            "title": rest[0],
            "url": f"https://www.facebook.com/marketplace/item/{item_id}/",
            "price": 0 if price == "Free" else (int(price.replace("$", "").replace(",", "")) if price else None),
            "original_price": prices[1] if len(prices) > 1 else None,
            "date_location": rest[1] if len(rest) > 1 else None,
            "image": html.unescape(img.group(1)) if img else None,
            "query": query,
        })
    return recs


def main():
    seen, results = set(), []
    for path in sorted(glob.glob(os.path.join(IN_DIR, "*.txt"))):
        query = os.path.basename(path)[:-4]
        raw = open(path).read()
        try:
            content = json.loads(raw)["content"]
        except (json.JSONDecodeError, KeyError, TypeError):
            content = raw
        recs = [r for r in parse(content, query) if r["url"] not in seen]
        for r in recs:
            seen.add(r["url"])
        results.extend(recs)
        print(f"{query}: {len(recs)} listings")
    with open(OUT, "w") as f:
        json.dump(results, f, indent=2)
    print(f"saved {len(results)} -> {OUT}")


if __name__ == "__main__":
    main()
