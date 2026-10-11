#!/usr/bin/env python3
"""Capture real ShopGoodwill listings for the Buy Buddy sample haystack.

Calls the same search endpoint the ShopGoodwill website uses, a handful of times,
for demo data only. Output: data/raw/shopgoodwill.json (each record keeps its live
listing URL — ADR-006).
"""
import json
import os
import time
import urllib.request

OUT = os.path.join(os.path.dirname(__file__), "..", "raw", "shopgoodwill.json")
API = "https://buyerapi.shopgoodwill.com/api/Search/ItemListing"

# Card searches, whole-PC searches, and multi-card "lot" searches
QUERIES = ["nvidia", "geforce", "rtx", "graphics card", "video card", "gpu lot",
           "graphics card lot", "gaming pc", "gaming computer", "gaming desktop"]


def search(text):
    body = {
        "isSize": False, "isWeddingCatagory": "false", "isMultipleCategoryIds": False,
        "isFromHeaderMenuTab": False, "layout": "", "isFromHomePage": False,
        "searchText": text, "selectedGroup": "", "selectedCategoryIds": "", "selectedSellerIds": "",
        "lowPrice": "0", "highPrice": "999999", "searchBuyNowOnly": "", "searchPickupOnly": "false",
        "searchNoPickupOnly": "false", "searchOneCentShippingOnly": "false", "searchDescriptions": "false",
        "searchClosedAuctions": "false", "closedAuctionEndingDate": "", "closedAuctionDaysBack": "7",
        "searchCanadaShipping": "false", "searchInternationalShippingOnly": "false", "sortColumn": "1",
        "page": "1", "pageSize": "40", "sortDescending": "false", "savedSearchId": 0,
        "useBuyerPrefs": "true", "searchUSOnlyShipping": "false", "categoryLevelNo": "1",
        "categoryLevel": 1, "categoryId": 0, "partNumber": "", "catIds": "",
    }
    req = urllib.request.Request(API, data=json.dumps(body).encode(),
                                 headers={"Content-Type": "application/json", "User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r).get("searchResults", {}).get("items", [])


def main():
    seen, results = set(), []
    for q in QUERIES:
        items = search(q)
        new = 0
        for it in items:
            if it["itemId"] in seen:
                continue
            seen.add(it["itemId"])
            new += 1
            results.append({
                "source": "ShopGoodwill",
                "title": it.get("title", "").strip(),
                "url": f"https://shopgoodwill.com/item/{it['itemId']}",
                "price": it.get("currentPrice"),
                "bids": it.get("numBids"),
                "buy_now": it.get("buyNowPrice") or None,
                "ends": it.get("endTime"),
                "category": it.get("categoryName"),
                "image": it.get("imageURL"),
                "description": (it.get("description") or "")[:1500],
                "seller_type": "institutional",
                "query": q,
            })
        print(f"{q!r}: {len(items)} results, {new} new")
        time.sleep(1)
    with open(OUT, "w") as f:
        json.dump(results, f, indent=2)
    print(f"saved {len(results)} -> {OUT}")


if __name__ == "__main__":
    main()
