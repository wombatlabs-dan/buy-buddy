#!/usr/bin/env python3
"""Parse saved eBay search-results HTML (from the Puget public browser) into listing records.

Input: data/raw/ebay-html/*.txt (JSON with a "content" field holding the results HTML)
Output: data/raw/ebay.json — each record has its live listing URL built from the
listing id (ADR-006).
"""
import glob
import html
import json
import os
import re

HERE = os.path.dirname(__file__)
IN_DIR = os.path.join(HERE, "..", "raw", "ebay-html")
OUT = os.path.join(HERE, "..", "raw", "ebay.json")


def text(fragment):
    """Strip tags and collapse whitespace."""
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", fragment))).strip()


def parse(content, query):
    records = []
    for card in re.split(r'(?=<li class="s-card)', content)[1:]:
        lid = re.search(r'data-listingid="(\d+)"', card)
        if not lid:
            continue
        title_m = re.search(r'class="s-card__title"[^>]*>(.*?)</div>', card, re.S)
        price_m = re.search(r'class="[^"]*s-card__price[^"]*"[^>]*>(.*?)</span>', card, re.S)
        img_m = re.search(r'<img[^>]+src="(https://i\.ebayimg\.com/[^"]+)"', card)
        sub_m = re.search(r'class="s-card__subtitle"[^>]*>(.*?)</div>', card, re.S)
        title = text(title_m.group(1)) if title_m else ""
        title = re.sub(r"^New Listing\s*", "", title).replace("Opens in a new window or tab", "").strip()
        price_txt = text(price_m.group(1)) if price_m else ""
        price = re.search(r"\$([\d,]+(?:\.\d\d)?)", price_txt)
        records.append({
            "source": "eBay",
            "title": title,
            "url": f"https://www.ebay.com/itm/{lid.group(1)}",
            "price": float(price.group(1).replace(",", "")) if price else None,
            "condition_brand": text(sub_m.group(1)) if sub_m else None,
            "image": img_m.group(1) if img_m else None,
            "query": query,
        })
    return records


def main():
    seen, results = set(), []
    for path in sorted(glob.glob(os.path.join(IN_DIR, "*.txt"))):
        query = os.path.basename(path)[:-4]
        with open(path) as f:
            raw = f.read()
        try:
            content = json.loads(raw)["content"]
        except (json.JSONDecodeError, KeyError):
            content = raw
        recs = [r for r in parse(content, query) if r["title"] and r["url"] not in seen]
        for r in recs:
            seen.add(r["url"])
        results.extend(recs)
        print(f"{query}: {len(recs)} listings")
    with open(OUT, "w") as f:
        json.dump(results, f, indent=2)
    print(f"saved {len(results)} -> {OUT}")


if __name__ == "__main__":
    main()
