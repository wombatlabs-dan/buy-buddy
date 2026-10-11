#!/usr/bin/env python3
"""Capture real Craigslist SF Bay listings for the Buy Buddy sample haystack.

Uses Dan's webfetch wrapper (which renders pages on Puget when needed) and parses
the search-results text into listing records. Output: data/raw/craigslist.json
Each record keeps its live listing URL (ADR-006: no listing without a live link).
"""
import json
import os
import re
import subprocess
import time

WEBFETCH = "/Users/dan/bin/webfetch"
OUT = os.path.join(os.path.dirname(__file__), "..", "raw", "craigslist.json")

# Two kinds of searches: the card itself (incl. misspellings) and vague whole-PC listings
QUERIES = [
    "4090", "rtx 4090", "rtx4090", "4o90", "nvidia 4090",
    "gaming pc", "gaming computer", "custom pc", "gaming desktop",
    "son computer", "computer not sure specs", "graphics card", "gpu",
]

TITLE_RE = re.compile(r"^(?P<title>.+?) \[(?P<url>https://www\.craigslist\.org/view/[^\]]+)\]$")
PRICE_RE = re.compile(r"^\$[\d,]+$")


def search(query):
    url = f"https://sfbay.craigslist.org/search/sss?query={query.replace(' ', '+')}&max_price=2500"
    out = subprocess.run([WEBFETCH, url], capture_output=True, text=True, timeout=200)
    try:
        content = json.loads(out.stdout)["content"]
    except (json.JSONDecodeError, KeyError):
        return []
    lines = [l.strip() for l in content.splitlines() if l.strip()]
    found = []
    for i, line in enumerate(lines):
        m = TITLE_RE.match(line)
        if not m or m.group("title").startswith("no image"):
            continue
        rec = {"source": "Craigslist", "title": m.group("title"), "url": m.group("url"),
               "query": query, "price": None, "date_location": None}
        # The next couple of lines hold "date location" and "$price"
        for nxt in lines[i + 1:i + 4]:
            if PRICE_RE.match(nxt) and rec["price"] is None:
                rec["price"] = int(nxt.replace("$", "").replace(",", ""))
            elif rec["date_location"] is None and re.match(r"^\d{1,2}/\d{1,2} ", nxt):
                rec["date_location"] = nxt
        found.append(rec)
    return found


def main():
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    seen, results = set(), []
    for q in QUERIES:
        hits = search(q)
        new = [h for h in hits if h["url"] not in seen]
        for h in new:
            seen.add(h["url"])
        results.extend(new)
        print(f"{q!r}: {len(hits)} hits, {len(new)} new")
        time.sleep(1)
    with open(OUT, "w") as f:
        json.dump(results, f, indent=2)
    print(f"saved {len(results)} listings -> {OUT}")


if __name__ == "__main__":
    main()
