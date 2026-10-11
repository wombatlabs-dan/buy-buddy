#!/usr/bin/env python3
"""Merge captured listings from every source into one haystack file for the demo.

Inputs: data/raw/{craigslist,ebay,shopgoodwill,facebook,offerup}.json (whichever exist)
Output: data/haystack.json — clearly labeled SAMPLE DATA, every record with a live URL.
Facebook Marketplace and OfferUp files come from Kevin's manual captures.
"""
import json
import os
import re
import time

HERE = os.path.dirname(__file__)
RAW = os.path.join(HERE, "..", "raw")
OUT = os.path.join(HERE, "..", "haystack.json")
SOURCES = ["craigslist", "ebay", "shopgoodwill", "facebook", "offerup"]


def clean(s):
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", s or "")).strip()


def main():
    listings = []
    for name in SOURCES:
        path = os.path.join(RAW, f"{name}.json")
        if not os.path.exists(path):
            print(f"{name}: not captured yet")
            continue
        with open(path) as f:
            recs = json.load(f)
        kept = 0
        for r in recs:
            if not r.get("url") or not r.get("title"):
                continue  # ADR-006: no listing without a live link
            listings.append({
                "id": f"{name}-{len(listings) + 1}",
                "source": r.get("source", name),
                "title": clean(r["title"]),
                "price": r.get("price"),
                "url": r["url"],
                "image": r.get("image"),
                "description": clean(r.get("description", ""))[:1500],
                "location": r.get("date_location"),
                "seller_type": r.get("seller_type", "individual"),
                "seller_account_age": r.get("seller_account_age"),
                "bids": r.get("bids"),
                "ends": r.get("ends"),
                "captured_query": r.get("query"),
            })
            kept += 1
        print(f"{name}: {kept} listings")
    data = {
        "label": "SAMPLE DATA — real listings captured on 2026-10-11 for the Buy Buddy demo",
        "captured_at": time.strftime("%Y-%m-%d %H:%M %Z"),
        "count": len(listings),
        "listings": listings,
    }
    with open(OUT, "w") as f:
        json.dump(data, f, indent=2)
    print(f"haystack: {len(listings)} listings -> {OUT}")


if __name__ == "__main__":
    main()
